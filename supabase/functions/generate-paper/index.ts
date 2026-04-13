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
    const { paperType, title, authors, keywords, additionalInfo, pageCount, customLatex } = await req.json();

    console.log('Generating paper:', { paperType, title, authors, keywords, pageCount });

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    let generatedContent = '';
    let latexSource = '';

    // Helper to escape LaTeX special characters in user-provided text.
    // IMPORTANT: Order matters — backslash must NOT be replaced first
    // because that would corrupt the replacement sequences.
    const escapeLatex = (str: string) => {
      return str
        .replace(/&/g, '\\&')
        .replace(/%/g, '\\%')
        .replace(/\$/g, '\\$')
        .replace(/#/g, '\\#')
        .replace(/_/g, '\\_')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}');
      // Note: We intentionally do NOT escape { } or \ in the title/keywords
      // because the AI may produce valid LaTeX commands in those fields.
    };

    const escapedTitle = escapeLatex(title);
    const escapedKeywords = keywords.map((k: string) => escapeLatex(k.trim())).join(', ');

    // If custom LaTeX is provided, skip AI generation and use it directly
    if (customLatex) {
      console.log('Using custom LaTeX source provided by user');
      latexSource = customLatex;
      generatedContent = 'Custom LaTeX provided - regenerating Word document';
    } else {

      // Create specialized prompts for each paper type with LaTeX formatting
      const systemPrompt = paperType === 'IEEE'
        ? `You are an expert LaTeX generator specialized in IEEE journal paper formatting using IEEEtran.cls.

CRITICAL RULES - MUST FOLLOW EXACTLY:

1. Generate ONLY the content sections - NO LaTeX document structure commands
2. Output pure academic text content with inline citations
3. Use IEEE citation format: [1], [2], [3] throughout the text
4. Be comprehensive, technical, and academically rigorous
5. DO NOT use any markdown formatting — no **, no ##, no \`\`\` fences, no bullet points with -

REQUIRED SECTIONS TO GENERATE:

ABSTRACT
- 150-250 words
- Describe problem, methodology, key findings
- No citations in abstract
- Plain text paragraph

KEYWORDS
- Exactly 5-7 keywords
- Comma-separated list
- No period at end

INTRODUCTION
- Start with: \\IEEEPARstart{T}{he} [rest of first sentence]
- 4-5 paragraphs minimum
- Include: background, motivation, problem statement, contributions
- Use citations [1], [2], [3] throughout
- End with paper organization paragraph

RELATED WORK or LITERATURE REVIEW
- Comprehensive review of existing research
- Minimum 3-4 paragraphs
- Compare different approaches
- Cite at least 8-12 papers [1], [2], [3]...
- Identify research gaps

METHODOLOGY or PROPOSED APPROACH
- Detailed technical description
- Use \\subsection{} for different components
- Include algorithms, system architecture
- 4-5 paragraphs minimum
- Technical depth with equations if needed

RESULTS or EXPERIMENTAL RESULTS
- Quantitative results and analysis
- Reference tables/figures (even if not included)
- Performance metrics
- 3-4 paragraphs minimum

DISCUSSION
- Interpretation of results
- Comparison with existing work
- Limitations and challenges
- 2-3 paragraphs minimum

CONCLUSION
- Summary of contributions
- Key findings
- Future work directions
- 2-3 paragraphs

REFERENCES
- Generate 12-15 realistic IEEE-style references
- Each on a new line starting with \\bibitem{ref1}, \\bibitem{ref2}, etc.
- Follow IEEE format EXACTLY:
  Author names, "Paper title," Journal/Conference, vol. X, no. Y, pp. ZZ-ZZ, Month Year.

OUTPUT FORMAT:
Generate sections with clear labels on their own line. No markdown, no bold, no fences:

ABSTRACT
[content here]

KEYWORDS
[keywords here]

INTRODUCTION
\\IEEEPARstart{T}{he} [content...]

LITERATURE_REVIEW
[content with \\subsection{} if needed]

METHODOLOGY
[content with \\subsection{} if needed]

RESULTS
[content...]

DISCUSSION
[content...]

CONCLUSION
[content...]

REFERENCES
\\bibitem{ref1}
[reference 1]
\\bibitem{ref2}
[reference 2]
...`
        : `You are an expert academic writer specializing in APA format research papers.

CRITICAL: Do NOT use any markdown formatting — no **, no ##, no \`\`\` fences.

Generate a complete, properly formatted research paper with the following structure:

ABSTRACT
[150-250 words abstract]

KEYWORDS
[5-7 comma-separated keywords]

INTRODUCTION
[Introduction with literature review, 4-5 paragraphs]

METHOD
[Method section with detailed methodology]

RESULTS
[Results section with findings]

DISCUSSION
[Discussion of results and implications]

CONCLUSION
[Summary and future work]

REFERENCES
[10+ references in APA 7th edition style, each on its own line]

Use professional academic language, include relevant in-text citations like (Author, Year), and follow APA guidelines.
Output ONLY plain text with section labels — no markdown.`;

      const userPrompt = `Generate a complete ${pageCount}-page ${paperType} research paper on:

Title: ${title}
Authors: ${authors}
Keywords: ${keywords.join(', ')}
${additionalInfo ? `Additional Context: ${additionalInfo}` : ''}

${paperType === 'IEEE' ? `
TARGET: Approximately ${pageCount * 500} words total across all sections.

Generate comprehensive, publication-ready content for a top-tier IEEE journal.

Make the content:
- Technically rigorous and detailed
- Well-researched with proper citations
- Professional academic writing style
- Realistic and coherent
- Suitable for IEEE Transactions journals

Include specific technical details, methodologies, and results relevant to the topic.
Use proper LaTeX formatting (\\subsection{}, \\IEEEPARstart{}, etc.) within the content.
Cite at least 12 high-quality references throughout the paper.

IMPORTANT: Output pure text with section labels. NO markdown formatting whatsoever.
` : `
TARGET: Approximately ${pageCount * 500} words total.
Create comprehensive APA content with proper in-text citations (Author, Year), methodology, discussion, and at least 10 references in APA format.
IMPORTANT: Output pure text with section labels. NO markdown formatting whatsoever.
`}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: systemPrompt + "\n\n" + userPrompt }]
            }
          ]
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const errorText = await response.text();
        console.error('Gemini API error:', response.status, errorText);
        throw new Error('Gemini API request failed: ' + response.status + ' - ' + errorText.substring(0, 500));
      }

      const data = await response.json();

      console.log('Gemini response status:', response.status);
      console.log('Gemini candidates count:', data.candidates?.length);

      // Check for blocked or empty responses
      if (!data.candidates || data.candidates.length === 0) {
        const blockReason = data.promptFeedback?.blockReason || 'Unknown';
        console.error('Gemini returned no candidates. Block reason:', blockReason, JSON.stringify(data).substring(0, 500));
        throw new Error(`AI request was blocked or returned no content. Reason: ${blockReason}. Try rephrasing your title.`);
      }

      const candidate = data.candidates[0];
      if (candidate.finishReason === 'SAFETY') {
        throw new Error('AI content was blocked by safety filters. Please try a different topic or title.');
      }
      if (!candidate.content?.parts?.[0]?.text) {
        console.error('Unexpected candidate structure:', JSON.stringify(candidate).substring(0, 500));
        throw new Error('AI returned an unexpected response format. Please try again.');
      }

      generatedContent = candidate.content.parts[0].text;

      console.log('Paper generated successfully, length:', generatedContent.length);

      // Sanitize AI output — strip markdown artifacts
      generatedContent = sanitizeAIOutput(generatedContent);

      // Parse generated content to extract sections
      const sections = parseSections(generatedContent);

      console.log('Parsed sections:', Object.keys(sections).join(', '));

      // Generate proper LaTeX source
      if (paperType === 'IEEE') {
        latexSource = buildIEEELatex(escapedTitle, authors, escapedKeywords, sections);
      } else {
        latexSource = buildAPALatex(escapedTitle, authors, escapedKeywords, sections, generatedContent);
      }
    } // End of AI generation block

    return new Response(
      JSON.stringify({
        content: generatedContent,
        latex_source: latexSource,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating paper:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate paper' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Strip markdown artifacts from AI output
 */
function sanitizeAIOutput(text: string): string {
  let cleaned = text;

  // Remove markdown code fences
  cleaned = cleaned.replace(/^```(?:latex|tex|json)?\s*\n?/gm, '');
  cleaned = cleaned.replace(/^```\s*$/gm, '');

  // Remove markdown bold/italic markers
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/(?<!\*)(\*)(?!\*)([^*]+)\*(?!\*)/g, '$2');

  // Remove markdown headings (## SECTION)
  cleaned = cleaned.replace(/^#+\s+/gm, '');

  return cleaned.trim();
}

/**
 * Parse section labels from generated content.
 * 
 * IMPORTANT: We do NOT use the /g flag on the regex with .test(),
 * because RegExp with /g flag advances lastIndex on each .test() call,
 * causing it to alternate true/false and skip sections.
 */
function parseSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const sectionNames = [
    'ABSTRACT', 'KEYWORDS', 'INTRODUCTION',
    'RELATED WORK', 'RELATED_WORK', 'LITERATURE REVIEW', 'LITERATURE_REVIEW',
    'METHODOLOGY', 'PROPOSED APPROACH', 'PROPOSED_APPROACH', 'METHOD',
    'RESULTS', 'EXPERIMENTAL RESULTS', 'EXPERIMENTAL_RESULTS',
    'DISCUSSION',
    'CONCLUSION',
    'REFERENCES'
  ];

  const lines = content.split('\n');
  let currentSection = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    // Remove any leading/trailing markdown artifacts from section labels
    const cleanedLabel = trimmedLine.replace(/^[#*]+\s*/, '').replace(/[*:]+$/, '').trim();
    const upperLabel = cleanedLabel.toUpperCase();

    if (sectionNames.includes(upperLabel)) {
      // Save previous section
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n').trim();
      }
      // Start new section — normalize spaces to underscores
      currentSection = upperLabel.replace(/\s+/g, '_');
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }
  // Save last section
  if (currentSection && currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n').trim();
  }

  return sections;
}

/**
 * Build IEEE format LaTeX document
 */
function buildIEEELatex(
  title: string,
  authors: string,
  keywords: string,
  sections: Record<string, string>
): string {
  return `\\documentclass[conference]{IEEEtran}
\\usepackage{cite}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{algorithmic}
\\usepackage{graphicx}
\\usepackage{textcomp}
\\usepackage{xcolor}
\\usepackage{url}
\\usepackage{hyperref}
\\usepackage{booktabs}

\\begin{document}

\\title{${title}}

\\author{${authors}}

\\maketitle

\\begin{abstract}
\\textit{${sections.ABSTRACT || 'Abstract content not generated.'}}
\\end{abstract}

\\begin{IEEEkeywords}
${sections.KEYWORDS || keywords}
\\end{IEEEkeywords}

\\section{Introduction}
${sections.INTRODUCTION || 'Introduction content not generated.'}

\\section{Related Work}
${sections.RELATED_WORK || sections.LITERATURE_REVIEW || 'Literature review content not generated.'}

\\section{Methodology}
${sections.METHODOLOGY || sections.PROPOSED_APPROACH || sections.METHOD || 'Methodology content not generated.'}

\\section{Results}
${sections.RESULTS || sections.EXPERIMENTAL_RESULTS || 'Results content not generated.'}

\\section{Discussion}
${sections.DISCUSSION || 'Discussion content not generated.'}

\\section{Conclusion}
${sections.CONCLUSION || 'Conclusion content not generated.'}

\\begin{thebibliography}{99}
${sections.REFERENCES || '\\bibitem{ref1}\nReference not generated.'}
\\end{thebibliography}

\\end{document}`;
}

/**
 * Build APA format LaTeX document.
 * Uses standard article class with natbib (available on texlive.net)
 * instead of apa7 package which is often unavailable.
 */
function buildAPALatex(
  title: string,
  authors: string,
  keywords: string,
  sections: Record<string, string>,
  fullContent: string
): string {
  const abstract = sections.ABSTRACT || '';
  const intro = sections.INTRODUCTION || '';
  const method = sections.METHOD || sections.METHODOLOGY || '';
  const results = sections.RESULTS || '';
  const discussion = sections.DISCUSSION || '';
  const conclusion = sections.CONCLUSION || '';
  const references = sections.REFERENCES || '';

  const hasStructuredSections = abstract || intro || method;

  if (hasStructuredSections) {
    return `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=1in]{geometry}
\\usepackage{setspace}
\\usepackage{natbib}
\\usepackage{url}
\\usepackage{hyperref}
\\usepackage{times}

\\doublespacing

\\title{${title}}
\\author{${authors}}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
${abstract || 'Abstract not generated.'}
\\end{abstract}

\\textbf{Keywords:} ${sections.KEYWORDS || keywords}

\\section{Introduction}
${intro || 'Introduction not generated.'}

\\section{Method}
${method || 'Method not generated.'}

\\section{Results}
${results || 'Results not generated.'}

\\section{Discussion}
${discussion || 'Discussion not generated.'}

\\section{Conclusion}
${conclusion || 'Conclusion not generated.'}

\\bibliographystyle{apalike}
\\begin{thebibliography}{99}
${references || '\\bibitem{ref1} Reference not generated.'}
\\end{thebibliography}

\\end{document}`;
  }

  // Fallback: dump the full content as-is
  return `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=1in]{geometry}
\\usepackage{setspace}
\\usepackage{times}
\\usepackage{url}
\\usepackage{hyperref}

\\doublespacing

\\title{${title}}
\\author{${authors}}
\\date{\\today}

\\begin{document}

\\maketitle

${fullContent}

\\end{document}`;
}
