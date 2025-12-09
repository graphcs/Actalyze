import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type MemoType = "press-release" | "newsletter" | "constituent-letter" | "floor-statement" | "social-media";

type Perspective = "democrat" | "republican" | "neutral";

interface GenerateRequest {
  type: MemoType;
  district?: string;
  topic: string;
  additionalContext?: string;
  perspective?: Perspective;
}

const MEMO_FORMATS: Record<MemoType, { systemPrompt: string; format: string }> = {
  "press-release": {
    systemPrompt: `You are an expert congressional communications director. Generate professional press releases following House of Representatives communication standards.`,
    format: `Generate a press release with the following structure:
- FOR IMMEDIATE RELEASE header with date
- Contact information placeholder
- Compelling headline (in title case)
- Dateline (Washington, D.C.)
- Strong opening paragraph with the key announcement
- 2-3 supporting paragraphs with details and quotes
- Background paragraph if relevant
- ### to indicate end
- Boilerplate "About" section placeholder

Use formal, professional language. Include a placeholder quote from the Member of Congress.`,
  },
  newsletter: {
    systemPrompt: `You are an expert congressional communications director. Generate engaging constituent newsletters following House of Representatives communication standards.`,
    format: `Generate a newsletter with the following structure:
- Personal greeting to constituents
- Brief introduction/overview section
- 2-3 main topic sections with headers
- Information about upcoming events or office hours (placeholder)
- Call to action for constituent engagement
- Warm closing with contact information placeholder

Use an accessible, warm but professional tone. Connect issues to constituent impact.`,
  },
  "constituent-letter": {
    systemPrompt: `You are an expert congressional communications director. Generate thoughtful constituent response letters following House of Representatives communication standards.`,
    format: `Generate a constituent letter with the following structure:
- Formal salutation
- Thank the constituent for reaching out
- Acknowledge their specific concern
- Explain the Member's position and any relevant actions
- Provide helpful information or resources
- Invitation for continued dialogue
- Formal closing with signature block placeholder

Use empathetic, respectful language. Be specific but avoid making promises that can't be kept.`,
  },
  "floor-statement": {
    systemPrompt: `You are an expert congressional speechwriter. Generate impactful floor statements following House of Representatives communication standards and parliamentary customs.`,
    format: `Generate a floor statement with the following structure:
- "Mr./Madam Speaker" opening
- Clear thesis statement
- Supporting arguments (2-3 main points)
- Personal story or constituent impact (if relevant)
- Call to action or position statement
- Strong closing that reinforces the main message
- "I yield back" or similar closing

Use formal parliamentary language. Be persuasive but factual.`,
  },
  "social-media": {
    systemPrompt: `You are an expert congressional communications director. Generate engaging social media content following House of Representatives communication standards and ethics guidelines.`,
    format: `Generate social media content with:
- Main post (under 280 characters for Twitter/X)
- Extended version for Facebook (2-3 paragraphs)
- 2-3 relevant hashtag suggestions
- Call to action if appropriate

Use engaging, accessible language. Avoid partisan attacks. Focus on policy and constituent service.`,
  },
};

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { type, district, topic, additionalContext, perspective } = body;

    if (!topic) {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    const format = MEMO_FORMATS[type];
    if (!format) {
      return NextResponse.json(
        { error: "Invalid memo type" },
        { status: 400 }
      );
    }

    const districtContext = district
      ? `The Member represents ${district}. Reference the district when appropriate.`
      : "";

    // Add perspective guidance if specified
    let perspectiveContext = "";
    if (perspective === "democrat") {
      perspectiveContext = `\n\nPERSPECTIVE: Write from a Democratic/progressive perspective. Emphasize values like social equity, environmental protection, workers' rights, healthcare access, and government programs that support working families. Use messaging and framing common in Democratic communications.`;
    } else if (perspective === "republican") {
      perspectiveContext = `\n\nPERSPECTIVE: Write from a Republican/conservative perspective. Emphasize values like fiscal responsibility, free markets, individual liberty, limited government, strong national defense, and traditional values. Use messaging and framing common in Republican communications.`;
    } else if (perspective === "neutral") {
      perspectiveContext = `\n\nPERSPECTIVE: Write from a strictly neutral, bipartisan perspective. Avoid partisan language or framing. Focus on facts, common ground, and solutions that appeal across party lines. Do not favor either party's talking points.`;
    }

    const userPrompt = `${format.format}

${districtContext}${perspectiveContext}

Topic/Description: ${topic}

${additionalContext ? `Additional Context: ${additionalContext}` : ""}

Generate the communication now. Make it professional, compelling, and ready for minor edits before use.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: format.systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const memo = response.choices[0]?.message?.content || "";

    return NextResponse.json({ memo });
  } catch (error) {
    console.error("Error generating memo:", error);
    return NextResponse.json(
      { error: "Failed to generate memo" },
      { status: 500 }
    );
  }
}
