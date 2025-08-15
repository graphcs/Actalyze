'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Document, AdminDashboardStats } from '@/types/rag'

interface DashboardStats {
    documents: {
        total: number
        pending_approval: number
        by_status: Record<string, number>
        by_category: Record<string, number>
    }
    processing: {
        active_jobs: number
    }
    storage: {
        total_bytes: number
        total_mb: number
        total_gb: number
    }
    chunks: {
        total: number
        average_per_document: number
    }
    recent_uploads: {
        id: string
        title: string
        source_type: string
        category?: string
        created_at: string
        status: string
    }[]
}

export default function AdminDashboardPage() {
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        checkAdminAccess()
    }, [])

    const checkAdminAccess = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            
            if (!user) {
                router.push('/auth')
                return
            }

            // Check if user is admin
            const { data: adminCheck } = await supabase
                .from('admin_roles')
                .select('permissions, role')
                .eq('user_id', user.id)
                .single()

            if (!adminCheck) {
                setIsAdmin(false)
                setError('Admin access required')
                setLoading(false)
                return
            }

            setIsAdmin(true)
            await loadDashboardStats()
        } catch (error) {
            console.error('Error checking admin access:', error)
            setError('Failed to verify admin access')
            setLoading(false)
        }
    }

    const loadDashboardStats = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            
            const response = await fetch('/api/admin/stats', {
                headers: {
                    'Authorization': `Bearer ${session?.access_token || ''}`
                }
            })

            if (!response.ok) {
                throw new Error('Failed to load dashboard stats')
            }

            const { stats } = await response.json()
            setStats(stats)
        } catch (error) {
            console.error('Error loading dashboard stats:', error)
            setError('Failed to load dashboard statistics')
        } finally {
            setLoading(false)
        }
    }

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'text-green-600 bg-green-100'
            case 'pending': return 'text-yellow-600 bg-yellow-100'
            case 'rejected': return 'text-red-600 bg-red-100'
            case 'archived': return 'text-gray-600 bg-gray-100'
            default: return 'text-gray-600 bg-gray-100'
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-cream-light flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-flex items-center space-x-2">
                        <div className="w-4 h-4 bg-orange-primary rounded-full animate-bounce"></div>
                        <div className="w-4 h-4 bg-orange-primary rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
                        <div className="w-4 h-4 bg-orange-primary rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                    </div>
                    <p className="mt-4 text-dark-gray">Loading admin dashboard...</p>
                </div>
            </div>
        )
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-cream-light flex items-center justify-center">
                <div className="w-full max-w-md text-center">
                    <h1 className="text-2xl font-semibold text-dark-gray mb-4">Access Denied</h1>
                    <p className="text-medium-gray mb-6">{error || 'You do not have admin privileges.'}</p>
                    <Link 
                        href="/"
                        className="inline-block bg-orange-light text-dark-gray px-6 py-3 rounded-full font-medium"
                    >
                        Return to Home
                    </Link>
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
                            <h2 className="text-xl font-semibold text-dark-gray">Admin Dashboard</h2>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link 
                                href="/admin/documents"
                                className="bg-orange-light text-dark-gray px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                            >
                                Manage Documents
                            </Link>
                            <Link 
                                href="/admin/upload"
                                className="bg-orange-primary text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                            >
                                Upload Document
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className="flex-1">
                                <p className="text-sm font-medium text-medium-gray">Total Documents</p>
                                <p className="text-2xl font-semibold text-dark-gray">{stats?.documents.total || 0}</p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className="flex-1">
                                <p className="text-sm font-medium text-medium-gray">Pending Approval</p>
                                <p className="text-2xl font-semibold text-yellow-600">{stats?.documents.pending_approval || 0}</p>
                            </div>
                            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className="flex-1">
                                <p className="text-sm font-medium text-medium-gray">Storage Used</p>
                                <p className="text-2xl font-semibold text-dark-gray">{formatFileSize(stats?.storage.total_bytes || 0)}</p>
                            </div>
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className="flex-1">
                                <p className="text-sm font-medium text-medium-gray">Total Chunks</p>
                                <p className="text-2xl font-semibold text-dark-gray">{stats?.chunks.total || 0}</p>
                            </div>
                            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Uploads and Status Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Recent Uploads */}
                    <div className="bg-white rounded-lg shadow">
                        <div className="p-6 border-b">
                            <h3 className="text-lg font-semibold text-dark-gray">Recent Uploads</h3>
                        </div>
                        <div className="p-6">
                            {stats?.recent_uploads && stats.recent_uploads.length > 0 ? (
                                <div className="space-y-4">
                                    {stats.recent_uploads.map((doc: { id: string; title: string; source_type: string; category?: string; created_at: string; status: string }) => (
                                        <div key={doc.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                            <div className="flex-1">
                                                <h4 className="font-medium text-dark-gray truncate">{doc.title}</h4>
                                                <p className="text-sm text-medium-gray">
                                                    {doc.source_type} • {doc.category || 'Uncategorized'}
                                                </p>
                                                <p className="text-xs text-medium-gray">
                                                    {new Date(doc.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                                                {doc.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-medium-gray text-center py-8">No recent uploads</p>
                            )}
                        </div>
                    </div>

                    {/* Status Breakdown */}
                    <div className="bg-white rounded-lg shadow">
                        <div className="p-6 border-b">
                            <h3 className="text-lg font-semibold text-dark-gray">Document Status</h3>
                        </div>
                        <div className="p-6">
                            {stats?.documents.by_status && Object.keys(stats.documents.by_status).length > 0 ? (
                                <div className="space-y-3">
                                    {Object.entries(stats.documents.by_status).map(([status, count]) => (
                                        <div key={status} className="flex items-center justify-between">
                                            <div className="flex items-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                                                    {status}
                                                </span>
                                            </div>
                                            <span className="font-semibold text-dark-gray">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-medium-gray text-center py-8">No documents found</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
