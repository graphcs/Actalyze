import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processDocument } from '@/lib/document-processor'
import { DocumentUploadData } from '@/types/rag'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: NextRequest) {
    try {
        // Create Supabase client (no auth needed - public access)
        const supabase = createClient(supabaseUrl, supabaseAnonKey)

        // Parse form data
        const formData = await request.formData()

        const title = formData.get('title') as string
        const content = formData.get('content') as string
        const sourceType = formData.get('source_type') as string
        const category = formData.get('category') as string
        const jurisdiction = formData.get('jurisdiction') as string
        const year = formData.get('year') as string
        const billNumber = formData.get('bill_number') as string
        const caseCitation = formData.get('case_citation') as string
        const metadata = JSON.parse(formData.get('metadata') as string || '{}')
        const file = formData.get('file') as File | null

        // Validation
        if (!title || title.trim().length === 0) {
            return NextResponse.json(
                { error: 'Document title is required' },
                { status: 400 }
            )
        }

        if (!sourceType || !['federal_law', 'state_law', 'regulation', 'case_law', 'bill'].includes(sourceType)) {
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

        // Prepare document upload data
        const documentData: DocumentUploadData = {
            title: title.trim(),
            content: content?.trim(),
            file: file || undefined,
            source_type: sourceType as DocumentUploadData['source_type'],
            category: category || undefined,
            jurisdiction: jurisdiction || undefined,
            year: year ? parseInt(year) : undefined,
            bill_number: billNumber || undefined,
            case_citation: caseCitation || undefined,
            metadata: {
                ...metadata,
                source: 'web_upload',
                upload_timestamp: new Date().toISOString()
            }
        }

        console.log('Processing document upload:', {
            title: documentData.title,
            hasFile: !!documentData.file,
            hasContent: !!documentData.content,
            sourceType: documentData.source_type
        })

        // Process the document (extract text, chunk, generate embeddings)
        const result = await processDocument(documentData)

        if (result.error) {
            console.error('Document processing error:', result.error)
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            )
        }

        console.log('Document processed successfully:', {
            documentId: result.documentId
        })

        return NextResponse.json({
            success: true,
            message: 'Document uploaded and processed successfully',
            document_id: result.documentId
        })

    } catch (error) {
        console.error('Upload API error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to upload document' },
            { status: 500 }
        )
    }
}
