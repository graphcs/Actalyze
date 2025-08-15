'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Document } from '@/types/rag'

interface DocumentWithUploader extends Document {
    uploader?: {
        id?: string
        first_name?: string
        last_name?: string
    }
    approver?: {
        id?: string
        first_name?: string
        last_name?: string
    }
}

interface DocumentsResponse {
    success: boolean
    documents: DocumentWithUploader[]
    pagination: {
        page: number
        limit: number
        total: number
        pages: number
    }
    availableTags: string[]
}

export default function ManageDocumentsPage() {
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
    const [documents, setDocuments] = useState<DocumentWithUploader[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedStatus, setSelectedStatus] = useState<string>('all')
    const [searchInput, setSearchInput] = useState<string>('') // Input field value
    const [searchQuery, setSearchQuery] = useState<string>('') // Debounced search query for API
    const [isSearching, setIsSearching] = useState(false) // Search debounce indicator
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [availableTags, setAvailableTags] = useState<string[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 })
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
    const [selectedDocument, setSelectedDocument] = useState<DocumentWithUploader | null>(null)
    const [showContentModal, setShowContentModal] = useState(false)
    const router = useRouter()

    useEffect(() => {
        checkAdminAccess()
    }, [])

    // Debounced search effect
    useEffect(() => {
        // If there's a difference between input and query, we're waiting for debounce
        if (searchInput.trim() !== searchQuery) {
            setIsSearching(true)
        }

        const timer = setTimeout(() => {
            setSearchQuery(searchInput.trim())
            setCurrentPage(1) // Reset to first page when search changes
            setIsSearching(false)
        }, 500) // 500ms delay

        return () => clearTimeout(timer)
    }, [searchInput, searchQuery])

    useEffect(() => {
        if (isAdmin) {
            loadDocuments()
        }
    }, [isAdmin, selectedStatus, searchQuery, selectedTags, currentPage])

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
        } catch (error) {
            console.error('Error checking admin access:', error)
            setError('Failed to verify admin access')
            setLoading(false)
        }
    }

    const loadDocuments = async () => {
        try {
            setLoading(true)
            const { data: { session } } = await supabase.auth.getSession()
            
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: '20'
            })

            if (selectedStatus !== 'all') {
                params.append('status', selectedStatus)
            }

            if (searchQuery.trim()) {
                params.append('search', searchQuery.trim())
            }

            if (selectedTags.length > 0) {
                params.append('tags', selectedTags.join(','))
            }

            const response = await fetch(`/api/admin/documents?${params}`, {
                headers: {
                    'Authorization': `Bearer ${session?.access_token || ''}`
                }
            })

            if (!response.ok) {
                throw new Error('Failed to load documents')
            }

            const data: DocumentsResponse = await response.json()
            setDocuments(data.documents)
            setPagination(data.pagination)
            setAvailableTags(data.availableTags)
        } catch (error) {
            console.error('Error loading documents:', error)
            setError('Failed to load documents')
        } finally {
            setLoading(false)
        }
    }

    const updateDocumentStatus = async (documentId: string, status: 'approved' | 'rejected' | 'archived') => {
        try {
            setProcessingIds(prev => new Set(prev).add(documentId))
            const { data: { session } } = await supabase.auth.getSession()

            const response = await fetch(`/api/admin/documents?id=${documentId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token || ''}`
                },
                body: JSON.stringify({ status })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to update document')
            }

            // Reload documents to reflect changes
            await loadDocuments()
        } catch (error) {
            console.error('Error updating document:', error)
            setError(error instanceof Error ? error.message : 'Failed to update document')
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev)
                newSet.delete(documentId)
                return newSet
            })
        }
    }

    const deleteDocument = async (documentId: string) => {
        if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
            return
        }

        try {
            setProcessingIds(prev => new Set(prev).add(documentId))
            const { data: { session } } = await supabase.auth.getSession()

            const response = await fetch(`/api/admin/documents?id=${documentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session?.access_token || ''}`
                }
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to delete document')
            }

            // Reload documents to reflect changes
            await loadDocuments()
        } catch (error) {
            console.error('Error deleting document:', error)
            setError(error instanceof Error ? error.message : 'Failed to delete document')
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev)
                newSet.delete(documentId)
                return newSet
            })
        }
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

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const formatFileSize = (bytes: number | null | undefined) => {
        if (!bytes) return 'N/A'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const openDocumentModal = (document: DocumentWithUploader) => {
        setSelectedDocument(document)
        setShowContentModal(true)
    }

    const closeDocumentModal = () => {
        setSelectedDocument(null)
        setShowContentModal(false)
    }

    const formatUserName = (user?: { first_name?: string; last_name?: string }) => {
        if (!user) return 'Unknown'
        const firstName = user.first_name || ''
        const lastName = user.last_name || ''
        const fullName = `${firstName} ${lastName}`.trim()
        return fullName || 'Unknown'
    }

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInput(e.target.value)
        // No need to reset currentPage here as it's handled in the debounced effect
    }

    const handleTagToggle = (tag: string) => {
        setSelectedTags(prev => {
            if (prev.includes(tag)) {
                return prev.filter(t => t !== tag)
            } else {
                return [...prev, tag]
            }
        })
        setCurrentPage(1) // Reset to first page when filtering
    }

    const clearFilters = () => {
        setSearchInput('')
        setSearchQuery('')
        setIsSearching(false)
        setSelectedTags([])
        setSelectedStatus('all')
        setCurrentPage(1)
    }

    if (loading && isAdmin === null) {
        return (
            <div className="min-h-screen bg-cream-light flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-flex items-center space-x-2">
                        <div className="w-4 h-4 bg-orange-primary rounded-full animate-bounce"></div>
                        <div className="w-4 h-4 bg-orange-primary rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
                        <div className="w-4 h-4 bg-orange-primary rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                    </div>
                    <p className="mt-4 text-dark-gray">Checking permissions...</p>
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
                        href="/admin"
                        className="inline-block bg-orange-light text-dark-gray px-6 py-3 rounded-full font-medium hover:opacity-90 transition-opacity"
                    >
                        Back to Admin Dashboard
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
                            <Link href="/admin">
                                <h1 className="brand-title text-2xl font-bold text-dark-green">GutRoot</h1>
                            </Link>
                            <span className="text-medium-gray">|</span>
                            <h2 className="text-xl font-semibold text-dark-gray">Manage Documents</h2>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link 
                                href="/admin/upload"
                                className="bg-orange-primary text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                            >
                                Upload Document
                            </Link>
                            <Link 
                                href="/admin"
                                className="text-medium-gray hover:text-dark-gray transition-colors"
                            >
                                Back to Dashboard
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
                        <button 
                            onClick={() => setError(null)}
                            className="ml-4 text-red-500 hover:text-red-700"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white rounded-lg shadow mb-6 p-6">
                    {/* Search and Status Row */}
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-dark-gray mb-2">Search documents:</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search by title or content..."
                                    value={searchInput}
                                    onChange={handleSearchChange}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none"
                                />
                                {isSearching && (
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        <div className="w-4 h-4 border-2 border-gray-300 border-t-orange-primary rounded-full animate-spin"></div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="md:w-48">
                            <label className="block text-sm font-medium text-dark-gray mb-2">Filter by status:</label>
                            <select
                                value={selectedStatus}
                                onChange={(e) => {
                                    setSelectedStatus(e.target.value)
                                    setCurrentPage(1)
                                }}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none"
                            >
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>
                    </div>

                    {/* Tags Filter */}
                    {availableTags.length > 0 && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-dark-gray mb-2">Filter by tags:</label>
                            <div className="flex flex-wrap gap-2">
                                {availableTags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => handleTagToggle(tag)}
                                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                            selectedTags.includes(tag)
                                                ? 'bg-orange-primary text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Results and Clear Filters */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-medium-gray">
                                Showing {documents.length} of {pagination.total} documents
                            </span>
                            {(searchInput || selectedTags.length > 0 || selectedStatus !== 'all') && (
                                <button
                                    onClick={clearFilters}
                                    className="text-sm text-orange-primary hover:text-orange-600 font-medium"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                        {selectedTags.length > 0 && (
                            <div className="text-sm text-medium-gray">
                                Selected tags: {selectedTags.join(', ')}
                            </div>
                        )}
                    </div>
                </div>

                {/* Documents Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="inline-flex items-center space-x-2">
                                <div className="w-4 h-4 bg-orange-primary rounded-full animate-bounce"></div>
                                <div className="w-4 h-4 bg-orange-primary rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
                                <div className="w-4 h-4 bg-orange-primary rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                            </div>
                            <p className="mt-4 text-dark-gray">Loading documents...</p>
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="p-8 text-center">
                            {(searchInput || selectedTags.length > 0 || selectedStatus !== 'all') ? (
                                <div>
                                    <p className="text-medium-gray mb-4">No documents match your current filters</p>
                                    <button 
                                        onClick={clearFilters}
                                        className="bg-orange-light text-dark-gray px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity mr-3"
                                    >
                                        Clear Filters
                                    </button>
                                    <Link 
                                        href="/admin/upload"
                                        className="inline-block bg-orange-primary text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                                    >
                                        Upload Document
                                    </Link>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-medium-gray">No documents found</p>
                                    <Link 
                                        href="/admin/upload"
                                        className="inline-block mt-4 bg-orange-light text-dark-gray px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                                    >
                                        Upload First Document
                                    </Link>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {documents.map((document) => (
                                        <tr key={document.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="max-w-xs">
                                                    <button
                                                        onClick={() => openDocumentModal(document)}
                                                        className="text-sm font-medium text-blue-600 hover:text-blue-800 truncate text-left cursor-pointer underline"
                                                    >
                                                        {document.title}
                                                    </button>
                                                    <p className="text-xs text-medium-gray mt-1">
                                                        {document.category && (
                                                            <span className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs mr-2">
                                                                {document.category}
                                                            </span>
                                                        )}
                                                        {document.tags?.length > 0 && (
                                                            <span className="text-gray-500">
                                                                {document.tags.slice(0, 2).join(', ')}
                                                                {document.tags.length > 2 && ` +${document.tags.length - 2}`}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-dark-gray capitalize">
                                                    {document.source_type.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(document.status)}`}>
                                                    {document.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-medium-gray">
                                                <div>
                                                    {formatDate(document.created_at)}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    by {formatUserName(document.uploader)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-medium-gray">
                                                {formatFileSize(document.file_size)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-2">
                                                    {document.status === 'pending' && (
                                                        <>
                                                            <button
                                                                onClick={() => updateDocumentStatus(document.id, 'approved')}
                                                                disabled={processingIds.has(document.id)}
                                                                className="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-medium hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {processingIds.has(document.id) ? '...' : 'Approve'}
                                                            </button>
                                                            <button
                                                                onClick={() => updateDocumentStatus(document.id, 'rejected')}
                                                                disabled={processingIds.has(document.id)}
                                                                className="bg-red-100 text-red-700 px-3 py-1 rounded text-xs font-medium hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {processingIds.has(document.id) ? '...' : 'Reject'}
                                                            </button>
                                                        </>
                                                    )}
                                                    {document.status === 'approved' && (
                                                        <button
                                                            onClick={() => updateDocumentStatus(document.id, 'archived')}
                                                            disabled={processingIds.has(document.id)}
                                                            className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {processingIds.has(document.id) ? '...' : 'Archive'}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => deleteDocument(document.id)}
                                                        disabled={processingIds.has(document.id)}
                                                        className="bg-red-100 text-red-700 px-3 py-1 rounded text-xs font-medium hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {processingIds.has(document.id) ? '...' : 'Delete'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                    <div className="mt-6 flex items-center justify-between">
                        <div className="text-sm text-medium-gray">
                            Page {pagination.page} of {pagination.pages}
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(Math.min(pagination.pages, currentPage + 1))}
                                disabled={currentPage === pagination.pages}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Document Content Modal */}
            {showContentModal && selectedDocument && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b">
                            <div className="flex-1">
                                <h2 className="text-xl font-semibold text-dark-gray truncate">
                                    {selectedDocument.title}
                                </h2>
                                <div className="flex items-center space-x-4 mt-2 text-sm text-medium-gray">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedDocument.status)}`}>
                                        {selectedDocument.status}
                                    </span>
                                    <span>
                                        {selectedDocument.source_type.replace('_', ' ')}
                                    </span>
                                    <span>
                                        {formatDate(selectedDocument.created_at)}
                                    </span>
                                    <span>
                                        by {formatUserName(selectedDocument.uploader)}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={closeDocumentModal}
                                className="ml-4 text-gray-400 hover:text-gray-600 text-2xl font-bold"
                            >
                                ×
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 p-6 overflow-y-auto">
                            {/* Document Metadata */}
                            <div className="mb-6">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <strong className="text-dark-gray">Category:</strong>{' '}
                                        <span className="text-medium-gray">
                                            {selectedDocument.category || 'Uncategorized'}
                                        </span>
                                    </div>
                                    <div>
                                        <strong className="text-dark-gray">File Size:</strong>{' '}
                                        <span className="text-medium-gray">
                                            {formatFileSize(selectedDocument.file_size)}
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <strong className="text-dark-gray">Tags:</strong>{' '}
                                        <span className="text-medium-gray">
                                            {selectedDocument.tags?.length > 0 ? selectedDocument.tags.join(', ') : 'No tags'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Document Content */}
                            <div>
                                <h3 className="text-lg font-semibold text-dark-gray mb-4">Content</h3>
                                <div className="bg-gray-50 rounded-lg p-4 text-sm leading-relaxed text-dark-gray max-h-96 overflow-y-auto">
                                    <pre className="whitespace-pre-wrap font-sans">
                                        {selectedDocument.content || 'No content available'}
                                    </pre>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t bg-gray-50">
                            <div className="flex justify-between items-center">
                                <div className="flex space-x-2">
                                    {selectedDocument.status === 'pending' && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    updateDocumentStatus(selectedDocument.id, 'approved')
                                                    closeDocumentModal()
                                                }}
                                                disabled={processingIds.has(selectedDocument.id)}
                                                className="bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {processingIds.has(selectedDocument.id) ? 'Processing...' : 'Approve'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    updateDocumentStatus(selectedDocument.id, 'rejected')
                                                    closeDocumentModal()
                                                }}
                                                disabled={processingIds.has(selectedDocument.id)}
                                                className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {processingIds.has(selectedDocument.id) ? 'Processing...' : 'Reject'}
                                            </button>
                                        </>
                                    )}
                                    {selectedDocument.status === 'approved' && (
                                        <button
                                            onClick={() => {
                                                updateDocumentStatus(selectedDocument.id, 'archived')
                                                closeDocumentModal()
                                            }}
                                            disabled={processingIds.has(selectedDocument.id)}
                                            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {processingIds.has(selectedDocument.id) ? 'Processing...' : 'Archive'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            deleteDocument(selectedDocument.id)
                                            closeDocumentModal()
                                        }}
                                        disabled={processingIds.has(selectedDocument.id)}
                                        className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {processingIds.has(selectedDocument.id) ? 'Processing...' : 'Delete'}
                                    </button>
                                </div>
                                <button
                                    onClick={closeDocumentModal}
                                    className="bg-gray-200 text-dark-gray px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
