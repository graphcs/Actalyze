import { NextRequest, NextResponse } from 'next/server'
import { sendGutHealthReportWithPDF } from '@/lib/email-service'
import { generateAndUploadPDF } from '@/lib/pdf-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: NextRequest) {
    try {
        const { reportData, reportId, assessmentId, userEmail } = await request.json()

        // Validate required data
        if (!reportData || !reportId || !assessmentId || !userEmail) {
            return NextResponse.json(
                { error: 'Missing required data: reportData, reportId, assessmentId, and userEmail are required' },
                { status: 400 }
            )
        }

        // Get the authorization header
        const authHeader = request.headers.get('authorization')

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Missing or invalid authorization header' },
                { status: 401 }
            )
        }

        const token = authHeader.substring(7) // Remove 'Bearer ' prefix

        // Create a Supabase client with the service role key
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        // Set the session from the token
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)

        if (authError || !user) {
            return NextResponse.json(
                { error: 'User not authenticated' },
                { status: 401 }
            )
        }

        // Get user profile and assessment data for the email
        const [userProfileResult, assessmentResult] = await Promise.all([
            supabase
                .from('user_profiles')
                .select('first_name, last_name')
                .eq('id', user.id)
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

        // Prepare data for PDF generation and email
        const emailReportData = {
            ...reportData,
            userProfile: {
                firstName: userProfileResult.data?.first_name,
                lastName: userProfileResult.data?.last_name
            },
            assessmentData: {
                age: formData.age,
                gender: formData.gender,
                initialReason: assessmentResult.data?.initial_reason
            }
        }

        console.log('Generating PDF and sending email for user:', user.email)

        // Step 1: Generate and upload PDF to Supabase Storage
        const pdfStartTime = Date.now()
        const { url: pdfUrl, error: pdfError } = await generateAndUploadPDF(
            emailReportData,
            user.id,
            reportId
        )

        let generationTime = 0
        if (pdfError) {
            console.error('PDF upload failed:', pdfError)
            // Continue with email even if PDF upload fails
        } else {
            generationTime = Date.now() - pdfStartTime
            console.log(`PDF uploaded successfully in ${generationTime}ms:`, pdfUrl)

            // Update the report record with PDF URL and generation time
            const { error: updateError } = await supabase
                .from('reports')
                .update({
                    pdf_url: pdfUrl,
                    generation_time_ms: generationTime
                })
                .eq('id', reportId)
                .eq('user_id', user.id)

            if (updateError) {
                console.error('Failed to update report with PDF URL:', updateError)
                // Continue anyway - PDF was uploaded successfully
            }
        }

        // Step 2: Send email with PDF attachment
        const userName = userProfileResult.data?.first_name || 'there'
        const { success, error: emailError, messageId } = await sendGutHealthReportWithPDF(
            userEmail,
            emailReportData,
            userName
        )

        if (!success || emailError) {
            console.error('Failed to send email with PDF:', emailError)
            return NextResponse.json(
                { error: `Email sending failed: ${emailError}` },
                { status: 500 }
            )
        }

        console.log('Email with PDF sent successfully:', messageId)

        // Step 3: Update the report record with email sent timestamp
        const { error: updateError } = await supabase
            .from('reports')
            .update({
                email_sent_at: new Date().toISOString()
            })
            .eq('id', reportId)

        if (updateError) {
            console.error('Failed to update report with email timestamp:', updateError)
            // Continue anyway - email was sent successfully
        }

        return NextResponse.json({
            success: true,
            emailSent: true,
            messageId,
            pdfUrl: pdfUrl || null,
            generationTimeMs: generationTime
        })

    } catch (error) {
        console.error('Error in email generation API:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
} 