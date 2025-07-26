import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface AssessmentMetadata {
    id: string
    completed_at: string
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
            .select('id, completed_at')
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
        const assessmentsByDay = new Map<string, AssessmentMetadata>()

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

        // Return metadata for cache validation
        return NextResponse.json({
            success: true,
            metadata: {
                assessmentCount: filteredWeeklyAssessments.length,
                assessmentIds: filteredWeeklyAssessments.map(a => a.id),
                hasAssessments: filteredWeeklyAssessments.length > 0
            }
        })

    } catch (error) {
        console.error('Error fetching weekly assessment metadata:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
} 