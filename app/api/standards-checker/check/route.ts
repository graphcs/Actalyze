import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CheckRequest {
  content: string;
  contentType: string;
}

interface CategoryResult {
  name: string;
  score: number;
  status: "pass" | "warning" | "fail";
  findings: string[];
  recommendations: string[];
}

interface CheckResult {
  overallScore: number;
  overallGrade: string;
  categories: CategoryResult[];
  summary: string;
}

const STANDARDS_PROMPT = `You are an expert on House of Representatives communication standards and the Franking Commission regulations. Analyze the provided congressional communication for compliance with official standards.

Evaluate the content against these categories:

1. **Franking Compliance** (Weight: 25%)
   - No solicitation of funds or campaign contributions
   - No partisan political content (attacks on parties, candidates)
   - No personal political purposes
   - Proper use of official letterhead/formats
   - No excessive personal images (if applicable)

2. **Nonpartisan Language** (Weight: 20%)
   - Avoids partisan attacks or inflammatory rhetoric
   - Presents issues factually
   - Acknowledges multiple perspectives where appropriate
   - Uses respectful language about colleagues

3. **Constituent Focus** (Weight: 20%)
   - Addresses constituent needs and concerns
   - Provides useful information or resources
   - Explains complex issues clearly
   - Includes actionable information

4. **Clarity & Accessibility** (Weight: 15%)
   - Written at appropriate reading level
   - Well-organized structure
   - Clear main message
   - Avoids excessive jargon

5. **Format & Professionalism** (Weight: 10%)
   - Follows standard format for content type
   - Professional tone throughout
   - Proper grammar and spelling
   - Appropriate length

6. **Ethical Compliance** (Weight: 10%)
   - No misleading claims
   - Accurate use of data/statistics
   - Proper attribution when needed
   - No promises that cannot be kept

For each category, provide:
- A score from 0-100
- Status: "pass" (80+), "warning" (60-79), or "fail" (below 60)
- Specific findings (what was observed)
- Recommendations for improvement

Calculate an overall weighted score and assign a letter grade:
- A+ (95-100), A (90-94), B+ (85-89), B (80-84), C+ (75-79), C (70-74), D (60-69), F (below 60)

Respond in JSON format exactly like this:
{
  "overallScore": 85,
  "overallGrade": "B+",
  "categories": [
    {
      "name": "Franking Compliance",
      "score": 90,
      "status": "pass",
      "findings": ["finding 1", "finding 2"],
      "recommendations": ["recommendation 1"]
    }
  ],
  "summary": "Brief overall assessment"
}`;

export async function POST(request: NextRequest) {
  try {
    const body: CheckRequest = await request.json();
    const { content, contentType } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: STANDARDS_PROMPT },
        {
          role: "user",
          content: `Content Type: ${contentType}

Content to analyze:
---
${content}
---

Analyze this content against House communication standards and provide your assessment in JSON format.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const resultText = response.choices[0]?.message?.content || "{}";

    let result: CheckResult;
    try {
      result = JSON.parse(resultText);
    } catch {
      // If JSON parsing fails, return a default error result
      result = {
        overallScore: 0,
        overallGrade: "N/A",
        categories: [],
        summary: "Failed to parse analysis results. Please try again.",
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error checking standards:", error);
    return NextResponse.json(
      { error: "Failed to check content" },
      { status: 500 }
    );
  }
}
