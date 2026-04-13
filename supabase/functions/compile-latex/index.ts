import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Base64 encode using Uint8Array (no external dependency)
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Sanitize LaTeX content — strip markdown artifacts that the AI sometimes injects
function sanitizeLatex(latex: string): string {
  let cleaned = latex;

  // Remove markdown code fences that sometimes wrap the LaTeX
  cleaned = cleaned.replace(/^```(?:latex|tex)?\s*\n?/gm, '');
  cleaned = cleaned.replace(/^```\s*$/gm, '');

  // Remove markdown bold/italic markers that leak into LaTeX content
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');

  // Fix common broken LaTeX from AI: double backslashes where single is needed
  // (but preserve intentional \\ for line breaks)
  
  return cleaned.trim();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { latex } = await req.json();

    if (!latex || typeof latex !== 'string') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid request: latex code is required' 
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Compiling LaTeX document...');
    console.log('LaTeX length:', latex.length, 'chars');

    // Sanitize the LaTeX content
    const cleanLatex = sanitizeLatex(latex);

    // Try primary compiler: texlive.net
    let pdfBytes: Uint8Array | null = null;
    let compileError = '';

    try {
      pdfBytes = await compileWithTexlive(cleanLatex);
    } catch (err: any) {
      console.error('texlive.net compilation failed:', err.message);
      compileError = err.message;
    }

    // Try fallback compiler: latex-online
    if (!pdfBytes) {
      try {
        console.log('Trying fallback compiler (latex.ytotech.com)...');
        pdfBytes = await compileWithYtotech(cleanLatex);
        compileError = ''; // Clear error if fallback succeeded
      } catch (err: any) {
        console.error('Fallback compiler also failed:', err.message);
        compileError = compileError + '\n\nFallback also failed: ' + err.message;
      }
    }

    if (!pdfBytes) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: compileError || 'LaTeX compilation failed with all compilers' 
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Convert PDF bytes to base64
    const base64Pdf = uint8ArrayToBase64(pdfBytes);

    // Create a data URL for the PDF
    const pdfDataUrl = `data:application/pdf;base64,${base64Pdf}`;

    console.log('LaTeX compilation successful, PDF size:', pdfBytes.length, 'bytes');

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdf_url: pdfDataUrl 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error in compile-latex function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error during compilation' 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/**
 * Primary compiler: texlive.net
 * Uses the official latexcgi API with multipart/form-data
 */
async function compileWithTexlive(latex: string): Promise<Uint8Array> {
  // The texlive.net API is strict about form fields.
  // It requires: filename[], filecontents[], and optionally engine and return.
  // Using the boundary-based approach for maximum compatibility.
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
  
  let body = '';
  
  // File name
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="filename[]"\r\n\r\n`;
  body += `document.tex\r\n`;
  
  // File contents
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="filecontents[]"\r\n\r\n`;
  body += `${latex}\r\n`;
  
  // Engine
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="engine"\r\n\r\n`;
  body += `pdflatex\r\n`;
  
  // Return type
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="return"\r\n\r\n`;
  body += `pdf\r\n`;
  
  body += `--${boundary}--\r\n`;

  const response = await fetch('https://texlive.net/cgi-bin/latexcgi', {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`texlive.net HTTP ${response.status}: ${errorText.substring(0, 500)}`);
  }

  const contentType = response.headers.get('content-type') || '';
  
  if (contentType.includes('application/pdf')) {
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  // Not a PDF response — extract error from HTML log
  const textResponse = await response.text();
  const cleanLog = textResponse.replace(/<[^>]*>?/gm, '').trim();
  
  // Look for LaTeX error lines
  const errorLines = cleanLog.split('\n').filter(
    line => line.trim().startsWith('!') || line.toLowerCase().includes('error')
  );
  
  let displayError = 'LaTeX compilation failed.';
  if (errorLines.length > 0) {
    displayError += '\n\n' + errorLines.slice(0, 10).join('\n');
  } else {
    displayError += '\n\n' + cleanLog.substring(0, 500);
  }
  
  throw new Error(displayError);
}

/**
 * Fallback compiler: latex.ytotech.com
 * A free LaTeX-to-PDF API
 */
async function compileWithYtotech(latex: string): Promise<Uint8Array> {
  const response = await fetch('https://latex.ytotech.com/builds/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      compiler: 'pdflatex',
      resources: [
        {
          main: true,
          content: latex,
        }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ytotech HTTP ${response.status}: ${errorText.substring(0, 500)}`);
  }

  const contentType = response.headers.get('content-type') || '';
  
  if (!contentType.includes('application/pdf')) {
    const errorText = await response.text();
    throw new Error(`ytotech returned non-PDF: ${errorText.substring(0, 500)}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
