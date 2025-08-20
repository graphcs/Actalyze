import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role for admin operations

interface CreateAdminRequest {
    email: string
    permissions: string[]
}

interface UpdateAdminRequest {
    userId: string
    permissions: string[]
}

// POST - Create new admin user
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

        // Create a Supabase client with user's token for authentication
        const supabaseUser = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            global: {
                headers: {
                    Authorization: authHeader
                }
            }
        })

        // Verify the requesting user's session
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token)

        if (authError || !user) {
            return NextResponse.json(
                { error: 'User not authenticated' },
                { status: 401 }
            )
        }

        // Check if requesting user has manage_users permission
        const { data: adminCheck } = await supabaseUser
            .from('admin_roles')
            .select('role, permissions')
            .eq('user_id', user.id)
            .single()

        if (!adminCheck) {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            )
        }

        const userPermissions = Array.isArray(adminCheck.permissions)
            ? adminCheck.permissions
            : JSON.parse(adminCheck.permissions as unknown as string || '[]')

        if (!userPermissions.includes('manage_users')) {
            return NextResponse.json(
                { error: 'Manage Users permission required' },
                { status: 403 }
            )
        }

        const { email, permissions }: CreateAdminRequest = await request.json()

        if (!email || !permissions || !Array.isArray(permissions)) {
            return NextResponse.json(
                { error: 'Email and permissions array are required' },
                { status: 400 }
            )
        }

        // Ensure view_analytics is always included
        const finalPermissions = permissions.includes('view_analytics')
            ? permissions
            : [...permissions, 'view_analytics']

        // Use service role client for admin operations
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

        // Find the user by email using Auth Admin API
        const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers()

        if (listError) {
            console.error('Error listing users:', listError)
            return NextResponse.json(
                { error: 'Failed to search for user' },
                { status: 500 }
            )
        }

        const targetUser = userList.users.find(user => user.email === email)

        if (!targetUser) {
            return NextResponse.json(
                { error: 'User not found. User must be registered first.' },
                { status: 404 }
            )
        }

        // Create or update admin role (always 'admin' now)
        // Using service role to avoid RLS recursion issues
        const { data: adminRole, error: roleError } = await supabaseAdmin
            .from('admin_roles')
            .upsert({
                user_id: targetUser.id,
                role: 'admin', // Always admin now
                permissions: finalPermissions, // Direct array, not JSON.stringify
                updated_at: new Date().toISOString()
            })
            .select()
            .single()

        if (roleError) {
            console.error('Error creating admin role:', roleError)
            return NextResponse.json(
                { error: 'Failed to create admin role' },
                { status: 500 }
            )
        }

        // Ensure user has a profile in user_profiles table
        const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .upsert({
                id: targetUser.id,
                email: targetUser.email,
                first_name: targetUser.user_metadata?.first_name || null,
                last_name: targetUser.user_metadata?.last_name || null,
                updated_at: new Date().toISOString()
            })

        if (profileError) {
            console.warn('Warning: Could not create user profile:', profileError.message)
            // Don't fail the admin creation if profile creation fails
        }

        return NextResponse.json({
            success: true,
            message: `Admin access created for ${email}`,
            admin: {
                email: targetUser.email,
                role: adminRole.role,
                permissions: adminRole.permissions
            }
        })

    } catch (error) {
        console.error('Error in admin creation:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// PATCH - Update existing admin user
export async function PATCH(request: NextRequest) {
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

        // Create a Supabase client with user's token for authentication
        const supabaseUser = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            global: {
                headers: {
                    Authorization: authHeader
                }
            }
        })

        // Verify the requesting user's session
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token)

        if (authError || !user) {
            return NextResponse.json(
                { error: 'User not authenticated' },
                { status: 401 }
            )
        }

        // Check if requesting user has manage_users permission
        const { data: adminCheck } = await supabaseUser
            .from('admin_roles')
            .select('role, permissions')
            .eq('user_id', user.id)
            .single()

        if (!adminCheck) {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            )
        }

        const userPermissions = Array.isArray(adminCheck.permissions)
            ? adminCheck.permissions
            : JSON.parse(adminCheck.permissions as unknown as string || '[]')

        if (!userPermissions.includes('manage_users')) {
            return NextResponse.json(
                { error: 'Manage Users permission required' },
                { status: 403 }
            )
        }

        const { userId, permissions }: UpdateAdminRequest = await request.json()

        if (!userId || !permissions || !Array.isArray(permissions)) {
            return NextResponse.json(
                { error: 'User ID and permissions array are required' },
                { status: 400 }
            )
        }

        // Prevent self-modification
        if (userId === user.id) {
            return NextResponse.json(
                { error: 'Cannot modify your own admin permissions' },
                { status: 400 }
            )
        }

        // Ensure view_analytics is always included
        const finalPermissions = permissions.includes('view_analytics')
            ? permissions
            : [...permissions, 'view_analytics']

        // Use service role client for admin operations
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

        // Build update object
        const updateData: Record<string, unknown> = {
            permissions: finalPermissions, // Direct array, not JSON.stringify
            updated_at: new Date().toISOString()
        }

        // Update admin role using service role to avoid RLS recursion
        const { data: updatedAdmin, error: updateError } = await supabaseAdmin
            .from('admin_roles')
            .update(updateData)
            .eq('user_id', userId)
            .select('*')
            .single()

        if (updateError) {
            console.error('Error updating admin role:', updateError)
            return NextResponse.json(
                { error: 'Failed to update admin role' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Admin role updated successfully',
            admin: updatedAdmin
        })

    } catch (error) {
        console.error('Error in admin update:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// DELETE - Remove admin role
export async function DELETE(request: NextRequest) {
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
        const { searchParams } = new URL(request.url)
        const userId = searchParams.get('userId')

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            )
        }

        // Create a Supabase client with user's token for authentication
        const supabaseUser = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            global: {
                headers: {
                    Authorization: authHeader
                }
            }
        })

        // Verify the requesting user's session
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token)

        if (authError || !user) {
            return NextResponse.json(
                { error: 'User not authenticated' },
                { status: 401 }
            )
        }

        // Check if requesting user has manage_users permission
        const { data: adminCheck } = await supabaseUser
            .from('admin_roles')
            .select('role, permissions')
            .eq('user_id', user.id)
            .single()

        if (!adminCheck) {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            )
        }

        const userPermissions = Array.isArray(adminCheck.permissions)
            ? adminCheck.permissions
            : JSON.parse(adminCheck.permissions as unknown as string || '[]')

        if (!userPermissions.includes('manage_users')) {
            return NextResponse.json(
                { error: 'Manage Users permission required' },
                { status: 403 }
            )
        }

        // Prevent self-deletion
        if (userId === user.id) {
            return NextResponse.json(
                { error: 'Cannot remove your own admin role' },
                { status: 400 }
            )
        }

        // Use service role client for admin operations
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

        // Remove admin role
        const { error: deleteError } = await supabaseAdmin
            .from('admin_roles')
            .delete()
            .eq('user_id', userId)

        if (deleteError) {
            console.error('Error removing admin role:', deleteError)
            return NextResponse.json(
                { error: 'Failed to remove admin role' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Admin role removed successfully'
        })

    } catch (error) {
        console.error('Error in admin deletion:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// GET - List all admin users
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

        // Create a Supabase client with user's token for authentication
        const supabaseUser = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            global: {
                headers: {
                    Authorization: authHeader
                }
            }
        })

        // Verify the requesting user's session
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token)

        if (authError || !user) {
            return NextResponse.json(
                { error: 'User not authenticated' },
                { status: 401 }
            )
        }

        // Check if requesting user is admin
        const { data: adminCheck } = await supabaseUser
            .from('admin_roles')
            .select('role, permissions')
            .eq('user_id', user.id)
            .single()

        if (!adminCheck) {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            )
        }

        // Use service role client for admin operations
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

        // Get all admin users
        const { data: admins, error: adminsError } = await supabaseAdmin
            .from('admin_roles')
            .select('*')
            .order('created_at', { ascending: false })

        if (adminsError) {
            console.error('Error fetching admins:', adminsError)
            return NextResponse.json(
                { error: 'Failed to fetch admin users' },
                { status: 500 }
            )
        }

        // Get user details using Supabase Auth Admin API
        const adminsWithUserInfo = []

        if (admins && admins.length > 0) {
            for (const admin of admins) {
                try {
                    // Use Supabase Auth Admin API to get user details
                    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(admin.user_id)

                    if (!userError && userData.user) {
                        adminsWithUserInfo.push({
                            ...admin,
                            user: {
                                id: userData.user.id,
                                email: userData.user.email,
                                created_at: userData.user.created_at
                            }
                        })
                    } else {
                        // Include admin even if user data fetch fails
                        adminsWithUserInfo.push({
                            ...admin,
                            user: {
                                id: admin.user_id,
                                email: 'Unknown User',
                                created_at: null
                            }
                        })
                    }
                } catch (error) {
                    console.error(`Error fetching user data for ${admin.user_id}:`, error)
                    // Include admin even if user data fetch fails
                    adminsWithUserInfo.push({
                        ...admin,
                        user: {
                            id: admin.user_id,
                            email: 'Unknown User',
                            created_at: null
                        }
                    })
                }
            }
        }

        return NextResponse.json({
            success: true,
            admins: adminsWithUserInfo
        })

    } catch (error) {
        console.error('Error in admin listing:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
