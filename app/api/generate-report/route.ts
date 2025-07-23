import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { OnboardingFormData } from '@/types/onboarding'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
    try {
        const { formData, initialReason, userProfile } = await request.json()

        if (!formData) {
            return NextResponse.json({ error: 'Assessment data is required' }, { status: 400 })
        }

        // Generate the AI report
        const report = await generateGutHealthReport(formData, initialReason, userProfile)

        return NextResponse.json({ report })
    } catch (error) {
        console.error('Error generating report:', error)
        return NextResponse.json(
            { error: 'Failed to generate report' },
            { status: 500 }
        )
    }
}

async function generateGutHealthReport(
    formData: OnboardingFormData,
    initialReason?: string,
    userProfile?: { firstName?: string; lastName?: string }
) {
    const prompt = buildComprehensivePrompt(formData, initialReason, userProfile)

    const completion = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
            {
                role: "system",
                content: "You are a certified nutritionist and gut health specialist with over 15 years of experience. You provide evidence-based, personalized recommendations for improving digestive health. Your advice is practical, actionable, and considers individual lifestyle factors."
            },
            {
                role: "user",
                content: prompt
            }
        ],
        temperature: 0.7,
        max_tokens: 3000
    })

    const response = completion.choices[0]?.message?.content

    if (!response) {
        throw new Error('No response from OpenAI')
    }

    // Parse the structured response
    return parseAIResponse(response)
}

function buildComprehensivePrompt(
    formData: OnboardingFormData,
    initialReason?: string,
    userProfile?: { firstName?: string; lastName?: string }
): string {
    const userName = userProfile?.firstName || "there"

    return `
# Gut Health Assessment Analysis

Hello ${userName}, I need you to analyze this comprehensive gut health assessment and provide personalized recommendations.

## Patient Information
- **Age**: ${formData.age}
- **Gender**: ${formData.gender}
- **Primary Concern**: ${initialReason || 'General gut health improvement'}

## Current Symptoms & Concerns
- **Gut Concerns**: ${Array.isArray(formData.gutConcerns) ? formData.gutConcerns.join(', ') : formData.gutConcerns}
- **Bowel Movement Frequency**: ${formData.bowelFrequency}
- **Stool Type**: ${formData.stoolType}

## Energy & Lifestyle Factors
- **Energy Level**: ${formData.energyLevel}/5
- **Sleep Quality**: ${formData.sleepQuality || 'Not specified'}
- **Mood Tracking**: ${formData.moodTracking}
- **Hydration Habits**: ${formData.hydrationHabits}

## Dietary Information
- **Dietary Pattern**: ${formData.dietaryPattern}
- **Cultural Food Preferences**: ${formData.culturalPreference}
- **Food Sensitivities**: ${Array.isArray(formData.foodSensitivities) ? formData.foodSensitivities.join(', ') : formData.foodSensitivities}
- **Overall Food Experience Rating**: ${formData.foodRating}

## Analysis Required

Please provide a comprehensive analysis and recommendations structured as follows:

### 1. DIGESTIVE_SCORE (0-10)
Calculate an overall digestive health score based on the assessment data.

### 2. DIET_RECOMMENDATIONS
Provide 4-5 specific dietary recommendations that address the identified concerns:
- Consider their cultural preferences and current dietary pattern
- Address any food sensitivities mentioned
- Focus on gut-healing foods and meal timing
- Include specific foods to add and foods to avoid

### 3. SUPPLEMENT_SUGGESTIONS
Recommend 3-4 evidence-based supplements:
- Prioritize based on their specific symptoms
- Include dosage recommendations
- Explain why each supplement is relevant to their case
- Consider interactions with their current diet

### 4. LIFESTYLE_CHANGES
Suggest 4-5 lifestyle modifications:
- Address sleep quality if mentioned as a concern
- Include stress management techniques
- Recommend physical activity appropriate for gut health
- Consider their energy levels and daily routine

### 5. BOWEL_TRENDS
Analyze their bowel movement patterns:
- Interpret their stool type and frequency
- Explain what this indicates about their digestive health
- Provide specific recommendations to optimize bowel health

### 6. GOAL_REMINDERS
Create 3-4 achievable weekly goals:
- Make them specific and measurable
- Prioritize based on their primary concerns
- Include both dietary and lifestyle goals

### 7. SYMPTOM_PATTERNS_ANALYSIS
Provide insights into their symptom patterns:
- Connect different symptoms to potential root causes
- Explain how their lifestyle factors may be contributing
- Identify the most important areas to focus on first

### 8. AI_TIP_OF_WEEK
Give one powerful, actionable tip they can implement this week:
- Make it specific to their assessment results
- Ensure it's something they can start immediately
- Focus on the highest-impact change

## Response Format
Please structure your response exactly as follows, using these exact headers:

**DIGESTIVE_SCORE:** [number]

**DIET_RECOMMENDATIONS:**
[detailed recommendations]

**SUPPLEMENT_SUGGESTIONS:**
[detailed suggestions]

**LIFESTYLE_CHANGES:**
[detailed changes]

**BOWEL_TRENDS:**
[analysis and recommendations]

**GOAL_REMINDERS:**
[specific weekly goals]

**SYMPTOM_PATTERNS_ANALYSIS:**
[comprehensive analysis]

**AI_TIP_OF_WEEK:**
[one powerful tip]

Make your recommendations evidence-based, practical, and personalized to this individual's specific situation. Consider their cultural background, current lifestyle, and primary concerns throughout your analysis.
`
}

interface ParsedReport {
    digestive_score: number
    diet_recommendations: string
    supplement_suggestions: string
    lifestyle_changes: string
    bowel_trends: string
    goal_reminders: string
    symptom_patterns_analysis: string
    ai_tip_of_week: string
}

function parseAIResponse(response: string): ParsedReport {
    const sections: ParsedReport = {
        digestive_score: 0,
        diet_recommendations: '',
        supplement_suggestions: '',
        lifestyle_changes: '',
        bowel_trends: '',
        goal_reminders: '',
        symptom_patterns_analysis: '',
        ai_tip_of_week: ''
    }

    try {
        // Extract digestive score
        const scoreMatch = response.match(/\*\*DIGESTIVE_SCORE:\*\*\s*(\d+)/i)
        if (scoreMatch) {
            sections.digestive_score = parseInt(scoreMatch[1])
        }

        // Extract each section with explicit typing
        const sectionPatterns: Record<keyof Omit<ParsedReport, 'digestive_score'>, RegExp> = {
            diet_recommendations: /\*\*DIET_RECOMMENDATIONS:\*\*([\s\S]*?)(?=\*\*[A-Z_]+:|$)/i,
            supplement_suggestions: /\*\*SUPPLEMENT_SUGGESTIONS:\*\*([\s\S]*?)(?=\*\*[A-Z_]+:|$)/i,
            lifestyle_changes: /\*\*LIFESTYLE_CHANGES:\*\*([\s\S]*?)(?=\*\*[A-Z_]+:|$)/i,
            bowel_trends: /\*\*BOWEL_TRENDS:\*\*([\s\S]*?)(?=\*\*[A-Z_]+:|$)/i,
            goal_reminders: /\*\*GOAL_REMINDERS:\*\*([\s\S]*?)(?=\*\*[A-Z_]+:|$)/i,
            symptom_patterns_analysis: /\*\*SYMPTOM_PATTERNS_ANALYSIS:\*\*([\s\S]*?)(?=\*\*[A-Z_]+:|$)/i,
            ai_tip_of_week: /\*\*AI_TIP_OF_WEEK:\*\*([\s\S]*?)(?=\*\*[A-Z_]+:|$)/i
        }

        // Extract each section
        Object.entries(sectionPatterns).forEach(([key, pattern]) => {
            const match = response.match(pattern)
            if (match && match[1]) {
                const sectionKey = key as keyof Omit<ParsedReport, 'digestive_score'>
                sections[sectionKey] = match[1].trim()
            }
        })

        return sections
    } catch (error) {
        console.error('Error parsing AI response:', error)
        // Return the raw response if parsing fails
        return {
            ...sections,
            diet_recommendations: response
        }
    }
} 