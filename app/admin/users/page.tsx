'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface AdminUser {
    id: string
    user_id: string
    role: 'admin' // Always 'admin' now
    permissions: string[]
    created_at: string
    updated_at: string
    user: {
        id: string
        email: string
        created_at: string
    }
}

interface CreateAdminForm {
    email: string
    permissions: string[]
}

const AVAILABLE_PERMISSIONS = [
    { key: 'upload_documents', label: 'Upload Documents', description: 'Can upload new documents' },
    { key: 'edit_documents', label: 'Edit Documents', description: 'Can edit document metadata' },
    { key: 'approve_documents', label: 'Approve Documents', description: 'Can approve or reject documents' },
    { key: 'delete_documents', label: 'Delete Documents', description: 'Can delete documents' },
    { key: 'manage_users', label: 'Manage Users', description: 'Can create and edit other admins' },
    { key: 'view_analytics', label: 'View Analytics', description: 'Can view system analytics' }
]

// Default permissions for new admins (view_analytics is always included)
const DEFAULT_PERMISSIONS = ['view_analytics']

export default function AdminUsersPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [canManageUsers, setCanManageUsers] = useState(false)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [admins, setAdmins] = useState<AdminUser[]>([])
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null)
    const [editingPermissions, setEditingPermissions] = useState<string[]>([])
    const [hasPermissionChanges, setHasPermissionChanges] = useState(false)
    
    const [createForm, setCreateForm] = useState<CreateAdminForm>({
        email: '',
        permissions: DEFAULT_PERMISSIONS
    })

    const router = useRouter()

    useEffect(() => {
        checkManageUsersAccess()
    }, [])

    const checkManageUsersAccess = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            
            if (!user) {
                router.push('/auth')
                return
            }

            // Check if user has manage_users permission
            const { data: adminCheck } = await supabase
                .from('admin_roles')
                .select('permissions, role')
                .eq('user_id', user.id)
                .single()

            if (!adminCheck) {
                setError('Admin access required')
                setIsLoading(false)
                return
            }

            // Check for manage_users permission
            const permissions = Array.isArray(adminCheck.permissions) 
                ? adminCheck.permissions 
                : JSON.parse(adminCheck.permissions as unknown as string || '[]')

            if (!permissions.includes('manage_users')) {
                setError('Manage Users permission required')
                setIsLoading(false)
                return
            }

            setCanManageUsers(true)
            setCurrentUserId(user.id)
            await loadAdmins()
        } catch (error) {
            console.error('Error checking manage users access:', error)
            setError('Failed to verify admin access')
            setIsLoading(false)
        }
    }

    const loadAdmins = async () => {
        try {
            setIsLoading(true)
            const { data: { session } } = await supabase.auth.getSession()
            
            if (!session?.access_token) {
                throw new Error('No access token')
            }

            const response = await fetch('/api/admin/manage-users', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                }
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to load admin users')
            }

            setAdmins(result.admins || [])
        } catch (error) {
            console.error('Error loading admins:', error)
            setError(error instanceof Error ? error.message : 'Failed to load admin users')
        } finally {
            setIsLoading(false)
        }
    }

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setError(null)
        setSuccess(null)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            
            if (!session?.access_token) {
                throw new Error('No access token')
            }

            const response = await fetch('/api/admin/manage-users', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(createForm)
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to create admin user')
            }

            setSuccess(`Successfully created admin access for ${createForm.email}`)
            setShowCreateForm(false)
            setCreateForm({
                email: '',
                permissions: DEFAULT_PERMISSIONS
            })
            await loadAdmins()

        } catch (error) {
            console.error('Error creating admin:', error)
            setError(error instanceof Error ? error.message : 'Failed to create admin user')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleUpdateAdmin = async (userId: string, permissions: string[]) => {
        setIsSubmitting(true)
        setError(null)
        setSuccess(null)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            
            if (!session?.access_token) {
                throw new Error('No access token')
            }

            const response = await fetch('/api/admin/manage-users', {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId,
                    permissions
                })
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update admin user')
            }

            setSuccess('Successfully updated admin permissions')
            setEditingAdmin(null)
            await loadAdmins()

        } catch (error) {
            console.error('Error updating admin:', error)
            setError(error instanceof Error ? error.message : 'Failed to update admin user')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteAdmin = async (userId: string, email: string) => {
        if (!confirm(`Are you sure you want to remove admin access for ${email}?`)) {
            return
        }

        setIsSubmitting(true)
        setError(null)
        setSuccess(null)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            
            if (!session?.access_token) {
                throw new Error('No access token')
            }

            const response = await fetch(`/api/admin/manage-users?userId=${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                }
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to remove admin user')
            }

            setSuccess(`Successfully removed admin access for ${email}`)
            await loadAdmins()

        } catch (error) {
            console.error('Error removing admin:', error)
            setError(error instanceof Error ? error.message : 'Failed to remove admin user')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handlePermissionToggle = (permission: string, checked: boolean) => {
        setCreateForm(prev => ({
            ...prev,
            permissions: checked 
                ? [...prev.permissions, permission]
                : prev.permissions.filter(p => p !== permission)
        }))
    }

    const startEditingPermissions = (admin: AdminUser) => {
        const permissions = Array.isArray(admin.permissions) 
            ? admin.permissions 
            : JSON.parse(admin.permissions as unknown as string || '[]')
        
        setEditingAdmin(admin)
        setEditingPermissions(permissions)
        setHasPermissionChanges(false)
    }

    const handleEditPermissionToggle = (permission: string, checked: boolean) => {
        const newPermissions = checked 
            ? [...editingPermissions, permission]
            : editingPermissions.filter(p => p !== permission)
        
        setEditingPermissions(newPermissions)
        
        // Check if there are changes
        const originalPermissions = Array.isArray(editingAdmin?.permissions) 
            ? editingAdmin.permissions 
            : JSON.parse(editingAdmin?.permissions as unknown as string || '[]')
        
        setHasPermissionChanges(
            JSON.stringify(newPermissions.sort()) !== JSON.stringify(originalPermissions.sort())
        )
    }

    const savePermissionChanges = async () => {
        if (!editingAdmin || !hasPermissionChanges) return
        
        await handleUpdateAdmin(editingAdmin.user_id, editingPermissions)
        cancelPermissionEdit()
    }

    const cancelPermissionEdit = () => {
        setEditingAdmin(null)
        setEditingPermissions([])
        setHasPermissionChanges(false)
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-cream-light flex items-center justify-center">
                <div className="text-center">
                    <div className="flex justify-center space-x-2 mb-4">
                        <div className="w-4 h-4 bg-orange-primary rounded-full animate-bounce"></div>
                        <div className="w-4 h-4 bg-orange-primary rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
                        <div className="w-4 h-4 bg-orange-primary rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                    </div>
                    <p className="mt-4 text-dark-gray">Loading admin users...</p>
                </div>
            </div>
        )
    }

    if (!canManageUsers) {
        return (
            <div className="min-h-screen bg-cream-light flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow text-center">
                    <div className="text-red-600 text-6xl mb-4">🚫</div>
                    <h1 className="text-2xl font-semibold text-dark-gray mb-2">Access Denied</h1>
                    <p className="text-medium-gray mb-6">{error || 'Manage Users permission required'}</p>
                    <button
                        onClick={() => router.push('/admin')}
                        className="bg-orange-light text-dark-gray px-6 py-3 rounded-full font-medium hover:opacity-90 transition-opacity"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-cream-light">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-4">
                            <Link href="/">
                                <h1 className="brand-title text-2xl font-bold text-dark-green">GutRoot</h1>
                            </Link>
                            <span className="text-medium-gray">|</span>
                            <h2 className="text-xl font-semibold text-dark-gray">Manage Users</h2>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link 
                                href="/admin/documents"
                                className="bg-orange-light text-dark-gray px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                            >
                                Manage Documents
                            </Link>
                            <Link 
                                href="/admin"
                                className="bg-orange-light text-dark-gray px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                            >
                                Dashboard
                            </Link>
                            <button
                                onClick={() => setShowCreateForm(true)}
                                className="bg-orange-primary text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                            >
                                <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Add Admin User
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Messages */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-6">
                        {success}
                    </div>
                )}

                {/* Create Admin Form */}
                {showCreateForm && (
                    <div className="bg-white rounded-lg shadow p-6 mb-6">
                        <div className="flex items-center mb-4">
                            <svg className="w-5 h-5 text-dark-gray mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                            <h2 className="text-xl font-semibold text-dark-gray">Create New Admin User</h2>
                        </div>
                        
                        <form onSubmit={handleCreateAdmin} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-dark-gray mb-1">
                                    Email Address *
                                </label>
                                <input
                                    type="email"
                                    value={createForm.email}
                                    onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none transition-all duration-200"
                                    placeholder="admin@company.com"
                                    required
                                />
                                <p className="text-xs text-medium-gray mt-1">User must be registered first</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-dark-gray mb-2">
                                    Select Permissions *
                                </label>
                                <div className="space-y-3">
                                    {AVAILABLE_PERMISSIONS.map(permission => (
                                        <label key={permission.key} className="flex items-start p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={createForm.permissions.includes(permission.key)}
                                                onChange={(e) => handlePermissionToggle(permission.key, e.target.checked)}
                                                className="mt-1 mr-3"
                                            />
                                            <div>
                                                <div className="font-medium text-dark-gray">{permission.label}</div>
                                                <div className="text-sm text-medium-gray">{permission.description}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-medium-gray mt-2">
                                    Note: View Analytics permission is included by default for all admins
                                </p>
                            </div>



                            <div className="flex gap-4 pt-4">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="bg-orange-primary text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    {isSubmitting ? 'Creating...' : 'Create Admin User'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateForm(false)
                                        setCreateForm({
                                            email: '',
                                            permissions: DEFAULT_PERMISSIONS
                                        })
                                    }}
                                    className="bg-orange-light text-dark-gray px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Admin Users List */}
                <div className="bg-white rounded-lg shadow">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center">
                            <svg className="w-5 h-5 text-dark-gray mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                            </svg>
                            <h2 className="text-xl font-semibold text-dark-gray">
                                Admin Users ({admins.length})
                            </h2>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-cream-100">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-medium-gray uppercase tracking-wider">
                                        User
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-medium-gray uppercase tracking-wider">
                                        Permissions
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-medium-gray uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-medium-gray uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {admins.map((admin) => {
                                    const permissions = Array.isArray(admin.permissions) 
                                        ? admin.permissions 
                                        : JSON.parse(admin.permissions as unknown as string || '[]')
                                    
                                    return (
                                        <tr key={admin.id}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    <div className="flex items-center">
                                                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                                                            <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center">
                                                                <div className="text-sm font-medium text-dark-gray">
                                                                    {admin.user?.email || 'Unknown'}
                                                                </div>
                                                                {admin.user_id === currentUserId && (
                                                                    <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">
                                                                        You
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-medium-gray">
                                                                ID: {admin.user_id.slice(0, 8)}...
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {permissions.map((perm: string) => {
                                                        const permInfo = AVAILABLE_PERMISSIONS.find(p => p.key === perm)
                                                        return permInfo ? (
                                                            <span key={perm} className="inline-block bg-cream-100 text-dark-gray text-xs px-2 py-1 rounded">
                                                                {permInfo.label}
                                                            </span>
                                                        ) : null
                                                    })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-medium-gray">
                                                {new Date(admin.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex gap-2">
                                                    {admin.user_id === currentUserId ? (
                                                        // Current user - no actions allowed
                                                        <span className="text-medium-gray text-sm italic">
                                                            No actions
                                                        </span>
                                                    ) : editingAdmin?.id === admin.id ? (
                                                        // Editing mode - show permission checkboxes with save/cancel
                                                        <div className="flex flex-col gap-3 min-w-64">
                                                            <div className="text-xs font-medium text-dark-gray">Edit Permissions:</div>
                                                            <div className="space-y-2 bg-cream-50 p-3 rounded-lg max-h-40 overflow-y-auto">
                                                                {AVAILABLE_PERMISSIONS.map(permission => (
                                                                    <label key={permission.key} className="flex items-start text-xs cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={editingPermissions.includes(permission.key)}
                                                                            onChange={(e) => handleEditPermissionToggle(permission.key, e.target.checked)}
                                                                            className="mr-2 mt-0.5"
                                                                            disabled={isSubmitting}
                                                                        />
                                                                        <div>
                                                                            <span className="text-dark-gray font-medium">{permission.label}</span>
                                                                            <div className="text-xs text-medium-gray">{permission.description}</div>
                                                                        </div>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={savePermissionChanges}
                                                                    disabled={!hasPermissionChanges || isSubmitting}
                                                                    className="bg-orange-primary text-white px-3 py-1 rounded text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                                                                </button>
                                                                <button
                                                                    onClick={cancelPermissionEdit}
                                                                    className="bg-orange-light text-dark-gray px-3 py-1 rounded text-xs font-medium hover:opacity-90 transition-opacity"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        // Normal actions for other users
                                                        <>
                                                            <button
                                                                onClick={() => startEditingPermissions(admin)}
                                                                className="bg-orange-light text-dark-gray px-3 py-1 rounded text-xs font-medium hover:opacity-90 transition-opacity"
                                                            >
                                                                <svg className="w-3 h-3 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                </svg>
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteAdmin(admin.user_id, admin.user?.email || 'Unknown')}
                                                                className="bg-red-100 text-red-700 px-3 py-1 rounded text-xs font-medium hover:bg-red-200 transition-colors"
                                                                disabled={isSubmitting}
                                                            >
                                                                <svg className="w-3 h-3 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                                Remove
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>

                        {admins.length === 0 && (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                    </svg>
                                </div>
                                <p className="text-medium-gray text-lg mb-2">No admin users found</p>
                                <p className="text-sm text-medium-gray">Get started by creating your first admin user</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
