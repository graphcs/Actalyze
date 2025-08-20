import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// GET - List documents with filtering and pagination
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)

        // Get the authorization header
        const authHeader = request.headers.get('authorization')

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Missing or invalid authorization header' },
                { status: 401 }
            )
        }

        const token = authHeader.substring(7)

        // Create a Supabase client with user's token
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: authHeader
                }
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

        // Check if user is admin
        const { data: adminCheck } = await supabase
            .from('admin_roles')
            .select('permissions, role')
            .eq('user_id', user.id)
            .single()

        if (!adminCheck) {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            )
        }

        // Parse query parameters
        const page = parseInt(searchParams.get('page') || '1')
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Max 100 items per page
        const status = searchParams.get('status')
        const sourceType = searchParams.get('source_type')
        const category = searchParams.get('category')
        const search = searchParams.get('search')
        const tags = searchParams.get('tags') // New: tag filtering
        const uploadedBy = searchParams.get('uploaded_by')

        // Build query
        let query = supabase
            .from('documents')
            .select('*')

        // Apply filters
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
            query = query.eq('status', status)
        }

        if (sourceType && ['pubmed', 'clinical_trial', 'medical_journal', 'manual_upload'].includes(sourceType)) {
            query = query.eq('source_type', sourceType)
        }

        if (category) {
            query = query.eq('category', category)
        }

        if (uploadedBy) {
            query = query.eq('uploaded_by', uploadedBy)
        }

        if (search) {
            query = query.or(`title.ilike.%${search}%, content.ilike.%${search}%`)
        }

        if (tags) {
            // Filter by tags - check if any of the specified tags exist in the document's tags array
            const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
            if (tagArray.length > 0) {
                // Use overlaps operator to check if arrays have common elements
                query = query.overlaps('tags', tagArray)
            }
        }

        // Get total count for pagination
        const countQuery = supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })

        // Apply same filters to count query
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
            countQuery.eq('status', status)
        }
        if (sourceType && ['pubmed', 'clinical_trial', 'medical_journal', 'manual_upload'].includes(sourceType)) {
            countQuery.eq('source_type', sourceType)
        }
        if (category) {
            countQuery.eq('category', category)
        }
        if (uploadedBy) {
            countQuery.eq('uploaded_by', uploadedBy)
        }
        if (search) {
            countQuery.or(`title.ilike.%${search}%, content.ilike.%${search}%`)
        }
        if (tags) {
            const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
            if (tagArray.length > 0) {
                countQuery.overlaps('tags', tagArray)
            }
        }

        const { count: totalCount } = await countQuery

        // Apply pagination and ordering
        const offset = (page - 1) * limit
        query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        const { data: documents, error } = await query

        if (error) {
            return NextResponse.json(
                { error: `Failed to fetch documents: ${error.message}` },
                { status: 500 }
            )
        }

        // Fetch user profile data for uploaders and approvers
        const userIds = new Set()
        documents?.forEach(doc => {
            if (doc.uploaded_by) userIds.add(doc.uploaded_by)
            if (doc.approved_by) userIds.add(doc.approved_by)
        })

        const { data: userProfiles } = await supabase
            .from('user_profiles')
            .select('id, first_name, last_name')
            .in('id', Array.from(userIds))

        // Create a map for quick lookup
        const userMap = new Map()
        userProfiles?.forEach(user => {
            userMap.set(user.id, user)
        })

        // Enhance documents with user data
        const enhancedDocuments = documents?.map(doc => ({
            ...doc,
            uploader: doc.uploaded_by ? userMap.get(doc.uploaded_by) : null,
            approver: doc.approved_by ? userMap.get(doc.approved_by) : null
        }))

        // Get all unique tags for the filter dropdown
        const { data: allDocuments } = await supabase
            .from('documents')
            .select('tags')
            .not('tags', 'is', null)

        const allTags = new Set()
        allDocuments?.forEach(doc => {
            if (doc.tags && Array.isArray(doc.tags)) {
                doc.tags.forEach(tag => allTags.add(tag))
            }
        })

        return NextResponse.json({
            success: true,
            documents: enhancedDocuments,
            pagination: {
                page,
                limit,
                total: totalCount || 0,
                pages: Math.ceil((totalCount || 0) / limit)
            },
            availableTags: Array.from(allTags).sort()
        })

    } catch (error) {
        console.error('Error fetching documents:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// PATCH - Update document status or other fields
export async function PATCH(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const documentId = searchParams.get('id')

        if (!documentId) {
            return NextResponse.json(
                { error: 'Document ID is required' },
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

        const token = authHeader.substring(7)

        // Create a Supabase client with user's token
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: authHeader
                }
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

        // Check if user is admin
        const { data: adminCheck } = await supabase
            .from('admin_roles')
            .select('permissions, role')
            .eq('user_id', user.id)
            .single()

        if (!adminCheck) {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            )
        }

        const body = await request.json()
        const { status, title, category, tags, source_type, metadata, is_active } = body

        // Parse permissions
        const permissions = Array.isArray(adminCheck.permissions)
            ? adminCheck.permissions
            : JSON.parse(adminCheck.permissions as unknown as string || '[]')

        // Prepare update data
        const updateData: Record<string, unknown> = {}

        // Status updates require approve_documents permission
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
            if (!permissions.includes('approve_documents')) {
                return NextResponse.json(
                    { error: 'Approve Documents permission required' },
                    { status: 403 }
                )
            }

            updateData.status = status

            // Set approval fields for approved status
            if (status === 'approved') {
                updateData.approved_by = user.id
                updateData.approved_at = new Date().toISOString()
            }
        }

        // Metadata updates require edit_documents permission
        if (title !== undefined || category !== undefined || tags !== undefined || source_type !== undefined || metadata !== undefined) {
            if (!permissions.includes('edit_documents')) {
                return NextResponse.json(
                    { error: 'Edit Documents permission required' },
                    { status: 403 }
                )
            }

            if (title !== undefined) updateData.title = title
            if (category !== undefined) updateData.category = category
            if (source_type !== undefined) updateData.source_type = source_type
            if (metadata !== undefined) updateData.metadata = metadata
            if (Array.isArray(tags)) updateData.tags = tags
        }

        if (typeof is_active === 'boolean') {
            updateData.is_active = is_active
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { error: 'No valid fields provided for update' },
                { status: 400 }
            )
        }

        // First verify the document exists
        const { data: existingDoc, error: checkError } = await supabase
            .from('documents')
            .select('id, status')
            .eq('id', documentId)
            .single()

        console.log('Document exists check:', existingDoc, 'Error:', checkError)

        if (checkError || !existingDoc) {
            return NextResponse.json(
                { error: 'Document not found in database' },
                { status: 404 }
            )
        }

        console.log('Updating document:', documentId, 'with data:', updateData)

        // Update document using user's authenticated session
        // RLS policies should now allow admins with proper permissions to update
        const { data: updatedDocument, error } = await supabase
            .from('documents')
            .update(updateData)
            .eq('id', documentId)
            .select()

        if (error) {
            console.error('Database update error:', error)
            return NextResponse.json(
                { error: `Failed to update document: ${error.message}` },
                { status: 500 }
            )
        }

        // Check if any rows were affected
        if (!updatedDocument || updatedDocument.length === 0) {
            return NextResponse.json(
                { error: 'Document not found or no changes made' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            document: updatedDocument[0],
            message: 'Document updated successfully'
        })

    } catch (error) {
        console.error('Error updating document:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// DELETE - Delete document and its chunks
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const documentId = searchParams.get('id')

        if (!documentId) {
            return NextResponse.json(
                { error: 'Document ID is required' },
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

        const token = authHeader.substring(7)

        // Create a Supabase client with user's token
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: authHeader
                }
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

        // Check if user has delete permissions
        const { data: adminCheck } = await supabase
            .from('admin_roles')
            .select('permissions, role')
            .eq('user_id', user.id)
            .single()

        if (!adminCheck) {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            )
        }

        // Check for delete_documents permission
        const permissions = Array.isArray(adminCheck.permissions)
            ? adminCheck.permissions
            : JSON.parse(adminCheck.permissions as unknown as string || '[]')

        if (!permissions.includes('delete_documents')) {
            return NextResponse.json(
                { error: 'Delete Documents permission required' },
                { status: 403 }
            )
        }

        // Get document info for file cleanup
        const { data: document } = await supabase
            .from('documents')
            .select('file_url')
            .eq('id', documentId)
            .single()

        // Delete document (chunks will be deleted via CASCADE)
        const { error: deleteError } = await supabase
            .from('documents')
            .delete()
            .eq('id', documentId)

        if (deleteError) {
            return NextResponse.json(
                { error: `Failed to delete document: ${deleteError.message}` },
                { status: 500 }
            )
        }

        // Clean up file from storage if exists
        if (document?.file_url) {
            try {
                const fileName = document.file_url.split('/').pop()
                if (fileName) {
                    await supabase.storage
                        .from('documents')
                        .remove([fileName])
                }
            } catch (storageError) {
                console.warn('Failed to delete file from storage:', storageError)
                // Don't fail the entire operation for storage cleanup
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Document deleted successfully'
        })

    } catch (error) {
        console.error('Error deleting document:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
