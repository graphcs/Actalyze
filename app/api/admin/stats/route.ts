import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// GET - Admin dashboard statistics
export async function GET(request: NextRequest) {
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

        // Gather statistics in parallel
        const [
            totalDocumentsResult,
            pendingApprovalResult,
            processingJobsResult,
            storageStatsResult,
            recentUploadsResult,
            statusBreakdownResult,
            categoryBreakdownResult
        ] = await Promise.all([
            // Total documents
            supabase
                .from('documents')
                .select('*', { count: 'exact', head: true }),

            // Pending approval
            supabase
                .from('documents')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending'),

            // Processing jobs
            supabase
                .from('document_processing_jobs')
                .select('*', { count: 'exact', head: true })
                .in('status', ['pending', 'processing']),

            // Storage usage (approximate)
            supabase
                .from('documents')
                .select('file_size')
                .not('file_size', 'is', null),

            // Recent uploads (last 10)
            supabase
                .from('documents')
                .select(`
                    id,
                    title,
                    status,
                    source_type,
                    category,
                    created_at,
                    uploader:uploaded_by(email)
                `)
                .order('created_at', { ascending: false })
                .limit(10),

            // Status breakdown
            supabase
                .from('documents')
                .select('status')
                .not('status', 'is', null),

            // Category breakdown
            supabase
                .from('documents')
                .select('category')
                .not('category', 'is', null)
        ])

        // Calculate storage usage
        let totalStorageBytes = 0
        if (storageStatsResult.data) {
            totalStorageBytes = storageStatsResult.data.reduce((sum, doc) => {
                return sum + (doc.file_size || 0)
            }, 0)
        }

        // Calculate status breakdown
        const statusCounts: Record<string, number> = {}
        if (statusBreakdownResult.data) {
            statusBreakdownResult.data.forEach(doc => {
                const status = doc.status || 'unknown'
                statusCounts[status] = (statusCounts[status] || 0) + 1
            })
        }

        // Calculate category breakdown
        const categoryCounts: Record<string, number> = {}
        if (categoryBreakdownResult.data) {
            categoryBreakdownResult.data.forEach(doc => {
                const category = doc.category || 'uncategorized'
                categoryCounts[category] = (categoryCounts[category] || 0) + 1
            })
        }

        // Get chunk statistics
        const { count: totalChunks } = await supabase
            .from('document_chunks')
            .select('*', { count: 'exact', head: true })

        const stats = {
            documents: {
                total: totalDocumentsResult.count || 0,
                pending_approval: pendingApprovalResult.count || 0,
                by_status: statusCounts,
                by_category: categoryCounts
            },
            processing: {
                active_jobs: processingJobsResult.count || 0
            },
            storage: {
                total_bytes: totalStorageBytes,
                total_mb: Math.round(totalStorageBytes / (1024 * 1024) * 100) / 100,
                total_gb: Math.round(totalStorageBytes / (1024 * 1024 * 1024) * 100) / 100
            },
            chunks: {
                total: totalChunks || 0,
                average_per_document: totalDocumentsResult.count ?
                    Math.round((totalChunks || 0) / totalDocumentsResult.count * 100) / 100 : 0
            },
            recent_uploads: recentUploadsResult.data || []
        }

        return NextResponse.json({
            success: true,
            stats
        })

    } catch (error) {
        console.error('Error fetching admin stats:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
