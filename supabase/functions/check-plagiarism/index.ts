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

    if (!content || typeof content !== 'string') {
      throw new Error('Paper content is required');
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    console.log('Running plagiarism analysis, content length:', content.length);

    const prompt = `You are an expert academic plagiarism detection system. Analyze the following research paper text and estimate a plagiarism/AI-detection score.

Evaluate the text on these criteria:
1. **Originality of phrasing** — Are sentences generic boilerplate or unique?
2. **Vocabulary diversity** — Is there varied word choice or repetitive patterns?
3. **Sentence structure variation** — Are sentences monotonously similar in length/structure?
4. **AI-typical patterns** — Does it use common AI phrases like "it is worth noting", "in recent years", "plays a crucial role", "comprehensive analysis", etc.?
5. **Natural flow** — Does the writing feel human with personality, or mechanical?
6. **Citation integration** — Are citations naturally woven in or formulaically inserted?

Based on your analysis, return ONLY a JSON object with this exact format (no markdown, no code fences, no extra text):
{"score": <number between 0 and 100>, "summary": "<brief 1-2 sentence explanation>"}

Where score means:
- 0-15: Highly original, human-written content
- 16-35: Mostly original with some common patterns
- 36-60: Mixed — contains notable generic/AI-like passages
- 61-85: Likely AI-generated or heavily borrowed content
- 86-100: Almost certainly AI-generated or plagiarized

TEXT TO ANALYZE:

${content.substring(0, 15000)}`;

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
          temperature: 0.3,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      throw new Error('Plagiarism analysis request failed: ' + response.status);
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No analysis returned from AI');
    }

    // Handle thinking model response — find the last text part
    const candidate = data.candidates[0];
    let rawText = '';

    if (candidate.content && candidate.content.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          rawText = part.text.trim();
        }
      }
    }

    if (!rawText) {
      throw new Error('AI returned empty analysis');
    }

    console.log('Raw AI response:', rawText.substring(0, 200));

    // Parse the JSON response — strip any markdown fences if present
    let cleanJson = rawText
      .replace(/^```(?:json)?\s*\n?/gm, '')
      .replace(/```\s*$/gm, '')
      .trim();

    let result: { score: number; summary: string };
    try {
      result = JSON.parse(cleanJson);
    } catch {
      // Fallback: try to extract score from text
      const scoreMatch = rawText.match(/["']?score["']?\s*:\s*(\d+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 45;
      result = { score, summary: 'Analysis completed with estimated score.' };
    }

    // Clamp score to 0-100
    const score = Math.max(0, Math.min(100, Math.round(result.score)));

    console.log('Plagiarism analysis complete. Score:', score);

    return new Response(
      JSON.stringify({
        success: true,
        score: score,
        summary: result.summary || 'Analysis completed.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in plagiarism check:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze paper'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});