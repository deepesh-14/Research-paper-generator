import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content } = await req.json();

    if (!content) {
      throw new Error('Paper content is required');
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const prompt = `You are an expert academic writing editor. Your task is to rewrite the following research paper content to make it sound more natural, human-written, and original while preserving ALL technical accuracy, structure, and meaning.

RULES:
1. Keep the EXACT SAME section structure (ABSTRACT, KEYWORDS, INTRODUCTION, etc.)
2. Keep ALL section labels exactly as they are (e.g. "ABSTRACT", "INTRODUCTION", "METHODOLOGY", etc.)
3. Preserve all citations like [1], [2], [3] and all \\bibitem references exactly as they are
4. Preserve all LaTeX commands like \\IEEEPARstart, \\subsection, \\bibitem etc.
5. DO NOT add any markdown formatting (no **, no ##, no \`\`\`)
6. Rewrite sentences to use more varied vocabulary, unique phrasing, and natural flow
7. Vary sentence length and structure - mix short punchy sentences with longer complex ones
8. Replace generic academic phrases with more specific, original expressions
9. Add subtle transitional phrases that feel organic
10. Keep the same approximate length
11. Output ONLY the rewritten content, nothing else

CONTENT TO HUMANIZE:

${content.substring(0, 30000)}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.9, // Higher temp for more creative/varied rewriting
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      throw new Error('Humanization request failed: ' + response.status);
    }

    const data = await response.json();

    console.log('Humanize response received');

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No content returned from AI');
    }

    // Handle thinking model response - find the last text part
    const candidate = data.candidates[0];
    let humanizedContent = '';

    if (candidate.content && candidate.content.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          humanizedContent = part.text.trim();
        }
      }
    }

    if (!humanizedContent) {
      throw new Error('AI returned empty content');
    }

    console.log('Content humanized successfully, length:', humanizedContent.length);

    return new Response(
      JSON.stringify({
        success: true,
        content: humanizedContent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error humanizing content:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to humanize content' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
