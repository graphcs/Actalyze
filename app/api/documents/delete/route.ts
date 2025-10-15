import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function DELETE(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey)
        const { searchParams } = new URL(request.url)
        const documentId = searchParams.get('id')

        if (!documentId) {
            return NextResponse.json(
                { error: 'Document ID is required' },
                { status: 400 }
            )
        }

        // Check if document exists
        const { data: existingDoc, error: fetchError } = await supabase
            .from('documents')
            .select('id, file_url')
            .eq('id', documentId)
            .single()

        if (fetchError || !existingDoc) {
            return NextResponse.json(
                { error: 'Document not found' },
                { status: 404 }
            )
        }

        // Delete document chunks first (cascade should handle this, but being explicit)
        const { error: chunksError } = await supabase
            .from('document_chunks')
            .delete()
            .eq('document_id', documentId)

        if (chunksError) {
            console.error('Error deleting document chunks:', chunksError)
        }

        // Delete the file from storage if it exists
        if (existingDoc.file_url) {
            try {
                // Extract the file path from the URL
                const urlParts = existingDoc.file_url.split('/');
                const fileName = urlParts[urlParts.length - 1];
                const bucketName = 'legislation-documents' // Adjust if different
                
                const { error: storageError } = await supabase
                    .storage
                    .from(bucketName)
                    .remove([fileName])

                if (storageError) {
                    console.error('Error deleting file from storage:', storageError)
                }
            } catch (storageErr) {
                console.error('Storage deletion error:', storageErr)
            }
        }

        // Delete the document record
        const { error: deleteError } = await supabase
            .from('documents')
            .delete()
            .eq('id', documentId)

        if (deleteError) {
            console.error('Error deleting document:', deleteError)
            return NextResponse.json(
                { error: 'Failed to delete document' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Document deleted successfully'
        })

    } catch (error) {
        console.error('Delete document API error:', error)
        return NextResponse.json(
            { error: 'Failed to delete document' },
            { status: 500 }
        )
    }
}
