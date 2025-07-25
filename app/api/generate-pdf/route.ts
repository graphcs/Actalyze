import { NextRequest, NextResponse } from 'next/server'
import { generateAndUploadPDF } from '@/lib/pdf-storage'
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

        // Create a Supabase client with the service role key for database operations
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

        console.log('Starting PDF generation for user:', user.id)

        // Generate and upload PDF
        const startTime = Date.now()
        const { url, error: pdfError } = await generateAndUploadPDF(
            reportData,
            user.id,
            reportId
        )

        if (pdfError || !url) {
            console.error('PDF generation failed:', pdfError)
            return NextResponse.json(
                { error: `PDF generation failed: ${pdfError}` },
                { status: 500 }
            )
        }

        const generationTime = Date.now() - startTime
        console.log(`PDF generated successfully in ${generationTime}ms:`, url)

        // Update the report record with the PDF URL and generation time
        const { error: updateError } = await supabase
            .from('reports')
            .update({
                pdf_url: url,
                generation_time_ms: generationTime
            })
            .eq('id', reportId)
            .eq('user_id', user.id) // Ensure user can only update their own reports

        if (updateError) {
            console.error('Failed to update report with PDF URL:', updateError)
            // Continue anyway - PDF was generated successfully
        }

        return NextResponse.json({
            success: true,
            pdfUrl: url,
            generationTimeMs: generationTime
        })

    } catch (error) {
        console.error('Error in PDF generation API:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
} 