import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.ACTALYZE_SUPABASE_URL!
const supabaseAnonKey = process.env.ACTALYZE_SUPABASE_ANON_KEY!

export async function GET(request: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey)
        const { searchParams } = new URL(request.url)

        // Get filter parameters
        const category = searchParams.get('category')
        const sourceType = searchParams.get('source_type')
        const jurisdiction = searchParams.get('jurisdiction')
        const year = searchParams.get('year')
        const status = searchParams.get('status') || 'active'
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = parseInt(searchParams.get('offset') || '0')

        // Build query
        let query = supabase
            .from('documents')
            .select('*', { count: 'exact' })
            .eq('is_active', true)
            .eq('status', status)
            .order('created_at', { ascending: false })

        // Apply filters
        if (category) {
            query = query.eq('category', category)
        }
        if (sourceType) {
            query = query.eq('source_type', sourceType)
        }
        if (jurisdiction) {
            query = query.eq('jurisdiction', jurisdiction)
        }
        if (year) {
            query = query.eq('year', parseInt(year))
        }

        // Apply pagination
        query = query.range(offset, offset + limit - 1)

        const { data: documents, error, count } = await query

        if (error) {
            console.error('Error fetching documents:', error)
            return NextResponse.json(
                { error: 'Failed to fetch documents' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            documents: documents || [],
            total: count || 0,
            limit,
            offset
        })

    } catch (error) {
        console.error('List documents API error:', error)
        return NextResponse.json(
            { error: 'Failed to list documents' },
            { status: 500 }
        )
    }
}
