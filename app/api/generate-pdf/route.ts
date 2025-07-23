import { NextRequest, NextResponse } from 'next/server'
import { generateAndUploadPDF, updateReportWithPDF } from '@/lib/pdf-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: NextRequest) {
    try {
        const { reportData, reportId, assessmentId } = await request.json()

        // Validate required data
        if (!reportData || !reportId || !assessmentId) {
            return NextResponse.json(
                { error: 'Missing required data: reportData, reportId, and assessmentId are required' },
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

        // Create a Supabase client with the user's session token
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        // Set the session from the token
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)

        console.log('User:', user)
        console.log('Report Data:', reportData)
        console.log('Report ID:', reportId)
        console.log('Assessment ID:', assessmentId)
        console.log('Auth Error:', authError)

        if (authError || !user) {
            return NextResponse.json(
                { error: 'User not authenticated' },
                { status: 401 }
            )
        }

        // Get user profile and assessment data for the PDF
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

        // Build assessment data for PDF
        const formData: Record<string, any> = {}
        responses?.forEach(response => {
            formData[response.question_id] = response.response_value
        })

        // Prepare data for PDF generation
        const pdfData = {
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

        // Generate and upload PDF
        const { pdfUrl, fileName, error: pdfError } = await generateAndUploadPDF(
            pdfData,
            user.id,
            assessmentId
        )

        if (pdfError || !pdfUrl) {
            return NextResponse.json(
                { error: `PDF generation failed: ${pdfError}` },
                { status: 500 }
            )
        }

        // Update the report record with PDF URL
        const { error: updateError } = await updateReportWithPDF(reportId, pdfUrl)

        if (updateError) {
            console.error('Failed to update report with PDF URL:', updateError)
            // Continue anyway - PDF was generated successfully
        }

        return NextResponse.json({
            success: true,
            pdfUrl,
            fileName
        })

    } catch (error) {
        console.error('Error in PDF generation API:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
} 