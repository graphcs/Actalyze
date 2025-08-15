import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processDocument } from '@/lib/document-processor'
import { DocumentUploadData } from '@/types/rag'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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

        // Create a Supabase client with the user's token
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: authHeader
                }
            }
        })

        // Verify the user's session
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)

        if (authError || !user) {
            return NextResponse.json(
                { error: 'User not authenticated' },
                { status: 401 }
            )
        }

        // Check if user is admin
        const { data: adminCheck } = await supabase
            .from('admin_roles')
            .select('permissions')
            .eq('user_id', user.id)
            .single()

        if (!adminCheck || (!adminCheck.permissions.includes('upload'))) {
            return NextResponse.json(
                { error: 'Insufficient permissions. Admin access required.' },
                { status: 403 }
            )
        }

        // Parse form data
        const formData = await request.formData()

        const title = formData.get('title') as string
        const content = formData.get('content') as string
        const sourceType = formData.get('source_type') as string
        const category = formData.get('category') as string
        const tags = JSON.parse(formData.get('tags') as string || '[]')
        const metadata = JSON.parse(formData.get('metadata') as string || '{}')
        const file = formData.get('file') as File | null

        // Validation
        if (!title || title.trim().length === 0) {
            return NextResponse.json(
                { error: 'Document title is required' },
                { status: 400 }
            )
        }

        if (!sourceType || !['pubmed', 'clinical_trial', 'medical_journal', 'manual_upload'].includes(sourceType)) {
            return NextResponse.json(
                { error: 'Valid source type is required' },
                { status: 400 }
            )
        }

        if (!content && !file) {
            return NextResponse.json(
                { error: 'Either content text or file must be provided' },
                { status: 400 }
            )
        }

        // Prepare upload data
        const uploadData: DocumentUploadData = {
            title: title.trim(),
            content: content?.trim(),
            file: file || undefined,
            source_type: sourceType as 'manual_upload' | 'pubmed' | 'clinical_trial' | 'medical_journal',
            category: category || undefined,
            tags: Array.isArray(tags) ? tags : [],
            metadata: typeof metadata === 'object' ? metadata : {}
        }

        // Process document
        const { documentId, success, error: processError } = await processDocument(uploadData, {
            chunking: {
                chunk_size: 800,
                overlap: 200,
                preserve_paragraphs: true
            },
            generate_embeddings: true,
            auto_approve: false, // Require manual approval by default
            userId: user.id
        })

        if (!success) {
            return NextResponse.json(
                { error: processError || 'Failed to process document' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            document_id: documentId,
            message: 'Document uploaded successfully and is pending approval'
        })

    } catch (error) {
        console.error('Error in document upload API:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
