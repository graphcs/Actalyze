import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import type { Assessment, QuestionResponse } from '@/types/database'
import { getMoodScore, getStoolTypeDescription } from '@/app/utils/utils'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface AssessmentDetail {
    assessment: Assessment
    responses: QuestionResponse[]
}

export async function POST(request: NextRequest) {
    try {
        // Get the authorization header
        const authHeader = request.headers.get('authorization')

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Missing or invalid authorization header' },
                { status: 401 }
            )
        }

        const token = authHeader.substring(7)

        // Create a Supabase client
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        // Verify the user's session token
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)

        if (authError || !user) {
            return NextResponse.json(
                { error: 'User not authenticated' },
                { status: 401 }
            )
        }

        // Get weekly assessments (last 7 days) - only the most recent assessment per day
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(endDate.getDate() - 7)

        const { data: weeklyAssessments, error: weeklyError } = await supabase
            .from('assessments')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .gte('completed_at', startDate.toISOString())
            .lte('completed_at', endDate.toISOString())
            .order('completed_at', { ascending: false })

        if (weeklyError) {
            return NextResponse.json(
                { error: `Failed to fetch weekly assessments: ${weeklyError.message}` },
                { status: 500 }
            )
        }

        // Filter to get only the most recent assessment per day
        const assessmentsByDay = new Map<string, Assessment>()

        weeklyAssessments?.forEach(assessment => {
            const assessmentDate = new Date(assessment.completed_at).toDateString()

            // If we don't have an assessment for this day, or this one is more recent, store it
            if (!assessmentsByDay.has(assessmentDate) ||
                new Date(assessment.completed_at) > new Date(assessmentsByDay.get(assessmentDate)!.completed_at)) {
                assessmentsByDay.set(assessmentDate, assessment)
            }
        })

        // Convert back to array and sort by date (most recent first)
        const filteredWeeklyAssessments = Array.from(assessmentsByDay.values())
            .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())

        // Redirect to initial question if no assessments
        if (!filteredWeeklyAssessments || filteredWeeklyAssessments.length === 0) {
            return NextResponse.json(
                { redirect: '/onboarding/initial-question' },
                { status: 200 }
            )
        }

        // Get detailed assessment data for this week
        const assessmentIds = filteredWeeklyAssessments.map(a => a.id)

        // Get all question responses for these assessments
        const { data: responses, error: responseError } = await supabase
            .from('question_responses')
            .select('*')
            .in('assessment_id', assessmentIds)

        if (responseError) {
            return NextResponse.json(
                { error: `Failed to fetch assessment details: ${responseError.message}` },
                { status: 500 }
            )
        }

        // Group responses by assessment_id
        const responsesByAssessment = (responses || []).reduce((acc, response) => {
            if (!acc[response.assessment_id!]) {
                acc[response.assessment_id!] = []
            }
            acc[response.assessment_id!].push(response)
            return acc
        }, {} as Record<string, QuestionResponse[]>)

        // Combine assessments with their responses
        const currentWeekDetails: AssessmentDetail[] = filteredWeeklyAssessments.map(assessment => ({
            assessment,
            responses: responsesByAssessment[assessment.id] || []
        }))

        // Get last week's data for comparison
        const currentWeekStart = new Date()
        currentWeekStart.setDate(currentWeekStart.getDate() - 7)

        const lastWeekStart = new Date(currentWeekStart)
        lastWeekStart.setDate(currentWeekStart.getDate() - 7)

        const { data: lastWeekAssessments } = await supabase
            .from('assessments')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .gte('completed_at', lastWeekStart.toISOString())
            .lt('completed_at', currentWeekStart.toISOString())
            .order('completed_at', { ascending: false })

        let lastWeekDetails: AssessmentDetail[] = []

        if (lastWeekAssessments && lastWeekAssessments.length > 0) {
            // Filter last week assessments to get only the most recent assessment per day
            const lastWeekAssessmentsByDay = new Map<string, Assessment>()

            lastWeekAssessments.forEach(assessment => {
                const assessmentDate = new Date(assessment.completed_at).toDateString()

                // If we don't have an assessment for this day, or this one is more recent, store it
                if (!lastWeekAssessmentsByDay.has(assessmentDate) ||
                    new Date(assessment.completed_at) > new Date(lastWeekAssessmentsByDay.get(assessmentDate)!.completed_at)) {
                    lastWeekAssessmentsByDay.set(assessmentDate, assessment)
                }
            })

            // Convert back to array
            const filteredLastWeekAssessments = Array.from(lastWeekAssessmentsByDay.values())

            const lastWeekIds = filteredLastWeekAssessments.map(a => a.id)
            const { data: lastWeekResponses } = await supabase
                .from('question_responses')
                .select('*')
                .in('assessment_id', lastWeekIds)

            const lastWeekResponsesByAssessment = (lastWeekResponses || []).reduce((acc, response) => {
                if (!acc[response.assessment_id!]) {
                    acc[response.assessment_id!] = []
                }
                acc[response.assessment_id!].push(response)
                return acc
            }, {} as Record<string, QuestionResponse[]>)

            lastWeekDetails = filteredLastWeekAssessments.map(assessment => ({
                assessment,
                responses: lastWeekResponsesByAssessment[assessment.id] || []
            }))
        }

        // Process and aggregate the weekly data
        const weeklyData = processWeeklyData(currentWeekDetails, lastWeekDetails)

        // Generate AI weekly progress report
        const weeklyReport = await generateWeeklyProgressReport(weeklyData)

        return NextResponse.json({
            success: true,
            report: weeklyReport,
            weeklyData: {
                ...weeklyData,
                averageDigestiveScore: weeklyReport.digestive_score // Use AI-generated score
            }
        })

    } catch (error) {
        console.error('Error generating weekly report:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

interface WeeklyData {
    totalAssessments: number
    daysWithAssessments: number
    averageDigestiveScore: number
    digestiveScoreRange: { min: number; max: number }
    bowelMovements: {
        daysWithBM: number
        totalDays: number
        mostCommonStoolType: string
        stoolTypes: Record<string, number>
    }
    symptoms: {
        bloating: { days: number; avgSeverity: number }
        heartburn: { days: number; avgSeverity: number }
        other: Record<string, { days: number; avgSeverity: number }>
    }
    energy: {
        avgLevel: number
        range: { min: number; max: number }
        totalTracked: number
    }
    mood: {
        avgScore: number
        totalTracked: number
        patterns: string[]
    }
    hydration: {
        avgGlasses: number
        daysTracked: number
        daysUnderTarget: number
    }
    lastWeekComparison?: {
        digestiveScoreChange: number
        bmFrequencyChange: number
        energyChange: number
    }
}

function processWeeklyData(
    currentWeekDetails: AssessmentDetail[],
    lastWeekDetails: AssessmentDetail[]
): WeeklyData {
    const weeklyData: WeeklyData = {
        totalAssessments: currentWeekDetails.length,
        daysWithAssessments: currentWeekDetails.length, // Simplified - one assessment per day max
        averageDigestiveScore: 0,
        digestiveScoreRange: { min: 10, max: 0 },
        bowelMovements: {
            daysWithBM: 0,
            totalDays: 7,
            mostCommonStoolType: '',
            stoolTypes: {}
        },
        symptoms: {
            bloating: { days: 0, avgSeverity: 0 },
            heartburn: { days: 0, avgSeverity: 0 },
            other: {}
        },
        energy: {
            avgLevel: 0,
            range: { min: 5, max: 1 },
            totalTracked: 0
        },
        mood: {
            avgScore: 0,
            totalTracked: 0,
            patterns: []
        },
        hydration: {
            avgGlasses: 0,
            daysTracked: 0,
            daysUnderTarget: 0
        }
    }

    // Process current week data
    let totalDigestiveScore = 0
    let totalEnergyLevel = 0
    let energyCount = 0
    let moodCount = 0
    let totalMoodScore = 0
    let hydrationCount = 0
    let totalHydration = 0

    currentWeekDetails.forEach(({ assessment, responses }) => {
        // Digestive score
        if (assessment.digestive_score) {
            totalDigestiveScore += assessment.digestive_score
            weeklyData.digestiveScoreRange.min = Math.min(weeklyData.digestiveScoreRange.min, assessment.digestive_score)
            weeklyData.digestiveScoreRange.max = Math.max(weeklyData.digestiveScoreRange.max, assessment.digestive_score)
        }

        // Process responses
        responses.forEach(response => {
            const value = response.response_value

            switch (response.question_id) {
                case 'bowelFrequency':
                    if (value && value !== 'rarely' && value !== 'never') {
                        weeklyData.bowelMovements.daysWithBM++
                    }
                    break

                case 'stoolType':
                    if (value) {
                        const stoolType = value as string
                        weeklyData.bowelMovements.stoolTypes[stoolType] = (weeklyData.bowelMovements.stoolTypes[stoolType] || 0) + 1
                    }
                    break

                case 'energyLevel':
                    if (typeof value === 'number') {
                        totalEnergyLevel += value
                        energyCount++
                        weeklyData.energy.range.min = Math.min(weeklyData.energy.range.min, value)
                        weeklyData.energy.range.max = Math.max(weeklyData.energy.range.max, value)
                    }
                    break

                case 'moodTracking':
                    if (typeof value === 'string') {
                        const moodScore = getMoodScore(value)
                        totalMoodScore += moodScore
                        moodCount++
                    }
                    break

                case 'hydrationHabits':
                    if (typeof value === 'string') {
                        // Extract glasses count from hydration response
                        const glasses = extractHydrationGlasses(value)
                        if (glasses > 0) {
                            totalHydration += glasses
                            hydrationCount++
                            if (glasses < 8) { // Target is 8 glasses
                                weeklyData.hydration.daysUnderTarget++
                            }
                        }
                    }
                    break

                case 'gutConcerns':
                    if (Array.isArray(value)) {
                        value.forEach((concern: unknown) => {
                            const concernStr = concern as string
                            if (concernStr.toLowerCase().includes('bloating')) {
                                weeklyData.symptoms.bloating.days++
                            }
                            if (concernStr.toLowerCase().includes('heartburn') || concernStr.toLowerCase().includes('acid reflux')) {
                                weeklyData.symptoms.heartburn.days++
                            }
                        })
                    }
                    break
            }
        })
    })

    // Calculate averages
    if (currentWeekDetails.length > 0) {
        weeklyData.averageDigestiveScore = totalDigestiveScore / currentWeekDetails.length
    }

    if (energyCount > 0) {
        weeklyData.energy.avgLevel = totalEnergyLevel / energyCount
        weeklyData.energy.totalTracked = energyCount
    }

    if (moodCount > 0) {
        weeklyData.mood.avgScore = totalMoodScore / moodCount
        weeklyData.mood.totalTracked = moodCount
    }

    if (hydrationCount > 0) {
        weeklyData.hydration.avgGlasses = totalHydration / hydrationCount
        weeklyData.hydration.daysTracked = hydrationCount
    }

    // Find most common stool type
    let maxCount = 0
    let mostCommon = ''
    Object.entries(weeklyData.bowelMovements.stoolTypes).forEach(([type, count]) => {
        if (count > maxCount) {
            maxCount = count
            mostCommon = type
        }
    })
    weeklyData.bowelMovements.mostCommonStoolType = getStoolTypeDescription(mostCommon)

    // Compare with last week if available
    if (lastWeekDetails.length > 0) {
        const lastWeekData = processWeeklyData(lastWeekDetails, [])
        weeklyData.lastWeekComparison = {
            digestiveScoreChange: weeklyData.averageDigestiveScore - lastWeekData.averageDigestiveScore,
            bmFrequencyChange: weeklyData.bowelMovements.daysWithBM - lastWeekData.bowelMovements.daysWithBM,
            energyChange: weeklyData.energy.avgLevel - lastWeekData.energy.avgLevel
        }
    }

    return weeklyData
}

function extractHydrationGlasses(hydrationResponse: string): number {
    // Simple extraction - can be enhanced based on actual response format
    const matches = hydrationResponse.match(/(\d+)/)
    return matches ? parseInt(matches[1]) : 0
}

async function generateWeeklyProgressReport(weeklyData: WeeklyData) {
    const prompt = buildWeeklyProgressPrompt(weeklyData)

    const completion = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
            {
                role: "system",
                content: "You are a certified nutritionist and gut health specialist analyzing weekly progress data. Provide specific, actionable insights based on the user's weekly patterns."
            },
            {
                role: "user",
                content: prompt
            }
        ],
        temperature: 0.7,
        max_tokens: 2500
    })

    const response = completion.choices[0]?.message?.content

    if (!response) {
        throw new Error('No response from OpenAI')
    }

    const parsedResponse = parseWeeklyAIResponse(response)

    return parsedResponse
}

function buildWeeklyProgressPrompt(weeklyData: WeeklyData): string {
    const comparison = weeklyData.lastWeekComparison
    const comparisonText = comparison
        ? `COMPARISON TO LAST WEEK:
- Digestive score: ${comparison.digestiveScoreChange > 0 ? '+' : ''}${comparison.digestiveScoreChange.toFixed(1)} points
- Bowel movements: ${comparison.bmFrequencyChange > 0 ? '+' : ''}${comparison.bmFrequencyChange} days
- Energy levels: ${comparison.energyChange > 0 ? '+' : ''}${comparison.energyChange.toFixed(1)} points`
        : 'No previous week data available for comparison.'

    // Build stool types summary with descriptions
    const stoolTypesText = Object.entries(weeklyData.bowelMovements.stoolTypes)
        .map(([type, count]) => `${getStoolTypeDescription(type)}: ${count} day${count > 1 ? 's' : ''}`)
        .join(', ')

    return `
# Weekly Gut Health Progress Analysis

## WEEK'S DATA SUMMARY:
- **Assessments completed**: ${weeklyData.totalAssessments} out of 7 days
- **Bowel movements**: ${weeklyData.bowelMovements.daysWithBM} out of 7 days
- **Most common stool type**: ${weeklyData.bowelMovements.mostCommonStoolType}
- **Stool types breakdown**: ${stoolTypesText || 'Not tracked'}
- **Average energy level**: ${weeklyData.energy.avgLevel.toFixed(1)}/5 (tracked ${weeklyData.energy.totalTracked} days)
- **Mood tracking**: ${weeklyData.mood.totalTracked} days tracked, avg score: ${weeklyData.mood.avgScore.toFixed(1)}/5
- **Hydration**: Avg ${weeklyData.hydration.avgGlasses.toFixed(1)} glasses/day, ${weeklyData.hydration.daysUnderTarget} days under target
- **Symptom patterns**: Bloating ${weeklyData.symptoms.bloating.days} days, Heartburn ${weeklyData.symptoms.heartburn.days} days

${comparisonText}

## ANALYSIS REQUIRED:
Generate a weekly progress report with these specific sections. Use the exact format and provide specific, data-driven insights:

### DIGESTIVE_SCORE
Based on the week's data (bowel movements, symptoms, energy, mood, hydration), provide a single digestive health score from 1-10 (integer only):
- 8-10: Excellent digestive health
- 6-7: Good digestive health with minor issues
- 4-5: Moderate digestive health, needs attention
- 1-3: Poor digestive health, significant issues

### DIGESTIVE_SCORE_EXPLANATION
Immediately after the score, output a concise ledger showing how the points add up.
- Use one line per factor, formatted like +3 points · Regular bowel movements (7 of 7 days).
- List the strongest positive contributors first, followed by any deductions with a minus sign (e.g., -1 point · Bloating reported 2 days at 3/5).
- Finish with a summary line such as Net: +4 points this week (no prior comparison) or Net: +5 points (up 1 vs last week).
- Keep this focused purely on the score math—do not restate detailed recommendations from later sections.

### BOWEL_TRENDS
Example: "You pooped ${weeklyData.bowelMovements.daysWithBM} out of 7 days this week — ${comparison ? (comparison.bmFrequencyChange > 0 ? `up from ${weeklyData.bowelMovements.daysWithBM - comparison.bmFrequencyChange}` : `down from ${weeklyData.bowelMovements.daysWithBM - comparison.bmFrequencyChange}`) + ' last week' : 'good consistency this week'}. Most stools were ${weeklyData.bowelMovements.mostCommonStoolType}."

### GOAL_REMINDERS  
Example: "Hydration slipped on ${weeklyData.hydration.daysUnderTarget} days — aim to drink at least 2 more glasses of water daily."

### SYMPTOM_PATTERNS
Example format:
"Bloating: Reported on ${weeklyData.symptoms.bloating.days} days — [pattern analysis]

Heartburn: [severity analysis if applicable]

Energy: Avg. energy score: ${weeklyData.energy.avgLevel.toFixed(1)}/5 — [highest/lowest pattern analysis]

Mood: Tracked ${weeklyData.mood.totalTracked} days — [correlation analysis]"

### AI_TIP_OF_WEEK
Provide one specific, actionable tip based on this week's patterns.

## FORMATTING RULES:
- Use clean section headers without asterisks
- Provide specific numbers and data points
- Compare to previous week when available
- Give actionable, personalized recommendations
- Focus on patterns and trends, not just individual days
- Make insights specific to this user's data

Generate the analysis focusing on progress, patterns, and practical next steps.
`
}

function parseWeeklyAIResponse(response: string) {
    const sections = {
        digestive_score: 5, // Default to 5 if not found
        digestive_score_explanation: '',
        bowel_trends: '',
        goal_reminders: '',
        symptom_patterns_analysis: '',
        ai_tip_of_week: '',
        // These sections can be added if needed
        diet_recommendations: '',
        supplement_suggestions: '',
        lifestyle_changes: ''
    }

    try {
        // Extract digestive score - it's on the line right after DIGESTIVE_SCORE
        const scoreMatch = response.match(/DIGESTIVE_SCORE\s*\n\s*(\d+)/i)
        if (scoreMatch) {
            const score = parseInt(scoreMatch[1])
            if (score >= 1 && score <= 10) {
                sections.digestive_score = score
            }
        }

        // Extract each section - the AI is using plain headers without ###
        const explanationMatch = response.match(/DIGESTIVE_SCORE_EXPLANATION\s*\n([\s\S]*?)(?=\nBOWEL_TRENDS|$)/i)
        if (explanationMatch) {
            sections.digestive_score_explanation = explanationMatch[1].trim()
        }

        const bowelMatch = response.match(/BOWEL_TRENDS\s*\n([\s\S]*?)(?=\nGOAL_REMINDERS|$)/i)
        if (bowelMatch) {
            sections.bowel_trends = bowelMatch[1].trim()
        }

        const goalMatch = response.match(/GOAL_REMINDERS\s*\n([\s\S]*?)(?=\nSYMPTOM_PATTERNS|$)/i)
        if (goalMatch) {
            sections.goal_reminders = goalMatch[1].trim()
        }

        const symptomMatch = response.match(/SYMPTOM_PATTERNS\s*\n([\s\S]*?)(?=\nAI_TIP_OF_WEEK|$)/i)
        if (symptomMatch) {
            sections.symptom_patterns_analysis = symptomMatch[1].trim()
        }

        const tipMatch = response.match(/AI_TIP_OF_WEEK\s*\n([\s\S]*?)$/i)
        if (tipMatch) {
            sections.ai_tip_of_week = tipMatch[1].trim()
        }

        return sections
    } catch (error) {
        console.error('Error parsing weekly AI response:', error)
        return {
            ...sections,
            bowel_trends: response // Return raw response if parsing fails
        }
    }
} 