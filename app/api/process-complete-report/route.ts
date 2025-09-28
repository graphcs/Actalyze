import { NextRequest, NextResponse } from 'next/server'
import { OnboardingFormData } from '@/types/onboarding'

interface CompleteReportData {
    assessmentId: string
    formData: OnboardingFormData
    userEmail: string
    userProfile: {
        firstName?: string
        lastName?: string
    }
    initialReason?: string
    userId: string
    retryCount?: number
}

const MAX_RETRIES = 3

export async function POST(request: NextRequest) {
    try {
        const requestData: CompleteReportData = await request.json()

        // Validate required data
        const { assessmentId, formData, userEmail, userProfile, initialReason, userId } = requestData

        if (!assessmentId || !formData || !userEmail || !userId) {
            return NextResponse.json(
                { error: 'Missing required data' },
                { status: 400 }
            )
        }

        console.log('🚀 Starting background report processing for user:', userId)

        // Process the complete report with retry logic
        const result = await processCompleteReportWithRetry(requestData, request.headers.get('authorization'))

        return NextResponse.json(result)

    } catch (error) {
        console.error('Error in complete report processing API:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

async function processCompleteReportWithRetry(
    data: CompleteReportData,
    authHeader: string | null = null,
    attempt: number = 1
): Promise<{ success: boolean; error?: string }> {

    try {
        console.log(`🔄 Processing attempt ${attempt}/${MAX_RETRIES}`)

        // Step 1: Generate AI report
        console.log('🧠 Generating AI report...')
        const reportResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/generate-report`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                formData: data.formData,
                initialReason: data.initialReason,
                userProfile: data.userProfile
            }),
        })

        if (!reportResponse.ok) {
            const errorData = await reportResponse.json()
            throw new Error(`AI report generation failed: ${errorData.error}`)
        }

        const { report } = await reportResponse.json()
        console.log('✅ AI report generated successfully')

        // Step 2: Save AI report to database
        console.log('💾 Saving report to database...')

        // Get authentication header and set up authenticated context
        if (!authHeader) {
            throw new Error('Missing authentication header')
        }

        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: {
                    headers: {
                        Authorization: authHeader
                    }
                }
            }
        )

        // Verify authentication
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)

        if (authError || !user) {
            throw new Error('Invalid authentication token')
        }

        // Save AI report manually with authenticated client
        const reportRecord = {
            assessment_id: data.assessmentId,
            user_id: user.id,
            report_type: 'comprehensive',
            digestive_score: report.digestive_score,
            diet_recommendations: report.diet_recommendations,
            supplement_suggestions: report.supplement_suggestions,
            lifestyle_changes: report.lifestyle_changes,
            bowel_trends: report.bowel_trends,
            goal_reminders: report.goal_reminders,
            symptom_patterns_analysis: report.symptom_patterns_analysis,
            ai_tip_of_week: report.ai_tip_of_week,
            ai_model_used: 'gpt-4.1',
            ai_prompt_version: '3.0',
            generation_time_ms: null,
            pdf_url: null,
            email_sent_at: null
        }

        const { data: reportData, error: reportError } = await supabase
            .from('reports')
            .insert(reportRecord)
            .select()
            .single()

        if (reportError || !reportData) {
            throw new Error(`Failed to save report: ${reportError?.message || 'No report data returned'}`)
        }

        const reportId = reportData.id

        // Update the assessment with the digestive score
        const { error: updateError } = await supabase
            .from('assessments')
            .update({ digestive_score: report.digestive_score })
            .eq('id', data.assessmentId)
            .eq('user_id', user.id)

        if (updateError) {
            console.warn('Failed to update assessment with digestive score:', updateError)
        }

        console.log('✅ Report saved to database:', reportId)

        // Step 3: Generate PDF and send email
        console.log('📧 Generating PDF and sending email...')
        const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/generate-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader // Pass the same auth token
            },
            body: JSON.stringify({
                reportData: {
                    ...report,
                    userProfile: data.userProfile,
                    assessmentData: {
                        age: data.formData?.age,
                        initialReason: data.initialReason
                    }
                },
                reportId: reportId,
                assessmentId: data.assessmentId,
                userEmail: data.userEmail
            }),
        })

        if (!emailResponse.ok) {
            const errorData = await emailResponse.json()
            throw new Error(`Email generation failed: ${errorData.error}`)
        }

        console.log('✅ Complete report processing finished successfully')
        return { success: true }

    } catch (error) {
        console.error(`❌ Attempt ${attempt} failed:`, error)

        // Retry logic
        if (attempt < MAX_RETRIES) {
            // Exponential backoff: 2^attempt seconds
            const delayMs = Math.pow(2, attempt) * 1000
            console.log(`⏳ Retrying in ${delayMs / 1000} seconds...`)

            await new Promise(resolve => setTimeout(resolve, delayMs))
            return processCompleteReportWithRetry(data, authHeader, attempt + 1)
        }

        // Max retries reached - send failure email
        console.error('💥 Max retries reached, sending failure email')
        await sendFailureEmail(data.userEmail, data.userProfile.firstName || 'there')

        return {
            success: false,
            error: `Failed after ${MAX_RETRIES} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
    }
}

async function sendFailureEmail(email: string, firstName: string): Promise<void> {
    try {
        const { sendEmail } = await import('@/lib/email-service')

        const subject = 'GutRoot - Assessment Issue'
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c3e50;">Hi ${firstName},</h2>
                
                <p>We encountered an issue generating your personalized gut health report.</p>
                
                <p>Don't worry - this sometimes happens due to high demand. To get your report:</p>
                
                <ol>
                    <li>Please retake the assessment at <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://gut-root.vercel.app'}">GutRoot.com</a></li>
                    <li>Your responses will be saved and processed immediately</li>
                </ol>
                
                <p>We apologize for the inconvenience and appreciate your patience.</p>
                
                <p>Best regards,<br>The GutRoot Team</p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #666;">
                    If you continue to experience issues, please contact our support team.
                </p>
            </div>
        `

        await sendEmail({
            to: email,
            subject,
            html
        })

        console.log('📧 Failure email sent successfully to:', email)

    } catch (error) {
        console.error('Failed to send failure email:', error)
        // Don't throw - this is just cleanup
    }
}
