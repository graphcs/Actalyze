import { NextRequest, NextResponse } from 'next/server'
import { generateAndUploadPDF } from '@/lib/pdf-storage'
import { sendGutHealthReportWithPDF } from '@/lib/email-service'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface BackgroundJobData {
    reportData: {
        digestive_score: number
        diet_recommendations: string
        supplement_suggestions: string
        lifestyle_changes: string
        bowel_trends: string
        goal_reminders: string
        symptom_patterns_analysis: string
        ai_tip_of_week: string
        userProfile?: {
            firstName?: string
            lastName?: string
        }
        assessmentData?: {
            age?: string
            initialReason?: string
        }
    }
    reportId: string
    assessmentId: string
    userEmail: string
    userId: string
    retryCount?: number
}

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000 // 2 seconds

export async function POST(request: NextRequest) {
    try {
        const jobData: BackgroundJobData = await request.json()

        console.log('🔄 Starting background report processing for user:', jobData.userId)

        const result = await processBackgroundJob(jobData)

        if (result.success) {
            console.log('✅ Background report processing completed successfully')
            return NextResponse.json({ success: true })
        } else {
            console.error('❌ Background report processing failed:', result.error)
            return NextResponse.json({ success: false, error: result.error }, { status: 500 })
        }

    } catch (error) {
        console.error('❌ Background report processing error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}

async function processBackgroundJob(jobData: BackgroundJobData, attempt: number = 1): Promise<{ success: boolean; error?: string }> {
    const { reportData, reportId, assessmentId, userEmail, userId } = jobData

    try {
        console.log(`📧 Processing background job - Attempt ${attempt}/${MAX_RETRIES}`)

        // Create Supabase client with service role key
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        // Get user profile and assessment data for enhanced email
        const [userProfileResult, assessmentResult] = await Promise.all([
            supabase
                .from('user_profiles')
                .select('first_name, last_name')
                .eq('id', userId)
                .single(),
            supabase
                .from('assessments')
                .select('initial_reason')
                .eq('id', assessmentId)
                .single()
        ])

        // Get assessment form data from question_responses
        const { data: responses } = await supabase
            .from('question_responses')
            .select('question_id, response_value')
            .eq('assessment_id', assessmentId)

        // Build assessment data for email
        const formData: Record<string, unknown> = {}
        responses?.forEach(response => {
            formData[response.question_id] = response.response_value
        })

        // Prepare enhanced report data for PDF and email
        const enhancedReportData = {
            ...reportData,
            userProfile: {
                firstName: userProfileResult.data?.first_name || reportData.userProfile?.firstName,
                lastName: userProfileResult.data?.last_name || reportData.userProfile?.lastName
            },
            assessmentData: {
                age: formData.age as string,
                initialReason: assessmentResult.data?.initial_reason || reportData.assessmentData?.initialReason
            }
        }

        console.log('📄 Generating PDF...')

        // Step 1: Generate and upload PDF to Supabase Storage
        const pdfStartTime = Date.now()
        const { url: pdfUrl, error: pdfError } = await generateAndUploadPDF(
            enhancedReportData,
            userId,
            reportId
        )

        if (pdfError) {
            throw new Error(`PDF generation failed: ${pdfError}`)
        }

        const generationTime = Date.now() - pdfStartTime
        console.log(`✅ PDF generated successfully in ${generationTime}ms:`, pdfUrl)

        // Update the report record with PDF URL and generation time
        const { error: updateError } = await supabase
            .from('reports')
            .update({
                pdf_url: pdfUrl,
                generation_time_ms: generationTime
            })
            .eq('id', reportId)
            .eq('user_id', userId)

        if (updateError) {
            console.error('⚠️ Failed to update report with PDF URL:', updateError)
            // Continue anyway - PDF was uploaded successfully
        }

        console.log('📧 Sending email with PDF...')

        // Step 2: Send email with PDF attachment
        const userName = enhancedReportData.userProfile?.firstName || 'there'
        const { success, error: emailError, messageId } = await sendGutHealthReportWithPDF(
            userEmail,
            enhancedReportData,
            userName
        )

        if (!success || emailError) {
            throw new Error(`Email sending failed: ${emailError}`)
        }

        console.log('✅ Email sent successfully:', messageId)

        // Step 3: Update the report record with email sent timestamp
        const { error: emailUpdateError } = await supabase
            .from('reports')
            .update({
                email_sent_at: new Date().toISOString()
            })
            .eq('id', reportId)

        if (emailUpdateError) {
            console.error('⚠️ Failed to update report with email timestamp:', emailUpdateError)
            // Continue anyway - email was sent successfully
        }

        return { success: true }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`❌ Background job attempt ${attempt} failed:`, errorMessage)

        // Retry logic
        if (attempt < MAX_RETRIES) {
            console.log(`🔄 Retrying in ${RETRY_DELAY_MS}ms... (Attempt ${attempt + 1}/${MAX_RETRIES})`)

            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))

            // Recursive retry
            return processBackgroundJob(jobData, attempt + 1)
        } else {
            console.error(`💥 All ${MAX_RETRIES} attempts failed. Giving up.`)
            return { success: false, error: errorMessage }
        }
    }
}