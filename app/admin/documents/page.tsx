'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Document, DOCUMENT_CATEGORIES } from '@/types/rag'

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

    const [activeTab, setActiveTab] = useState<'view' | 'edit'>('view')
    const [editForm, setEditForm] = useState({
        title: '',
        category: '',
        tags: [] as string[],
        source_type: '',
        metadata: {} as Record<string, unknown>
    })
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

    const approveDocument = async (documentId: string) => {
        try {
            setProcessingIds(prev => new Set(prev).add(documentId))
            const { data: { session } } = await supabase.auth.getSession()

            const response = await fetch(`/api/admin/documents?id=${documentId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token || ''}`
                },
                body: JSON.stringify({ status: 'approved' })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to approve document')
            }

            // Reload documents to reflect changes
            await loadDocuments()
        } catch (error) {
            console.error('Error approving document:', error)
            setError(error instanceof Error ? error.message : 'Failed to approve document')
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev)
                newSet.delete(documentId)
                return newSet
            })
        }
    }

    const rejectDocument = async (documentId: string) => {
        if (!confirm('Are you sure you want to reject this document? This will permanently delete it and cannot be undone.')) {
            return
        }

        try {
            setProcessingIds(prev => new Set(prev).add(documentId))
            const { data: { session } } = await supabase.auth.getSession()

            // Reject = hard delete
            const response = await fetch(`/api/admin/documents?id=${documentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session?.access_token || ''}`
                }
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to reject document')
            }

            // Close modal if the rejected document was being viewed
            if (selectedDocument?.id === documentId) {
                setShowContentModal(false)
                setSelectedDocument(null)
            }

            // Reload documents to reflect changes
            await loadDocuments()
        } catch (error) {
            console.error('Error rejecting document:', error)
            setError(error instanceof Error ? error.message : 'Failed to reject document')
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev)
                newSet.delete(documentId)
                return newSet
            })
        }
    }



    const saveDocumentEdit = async () => {
        if (!selectedDocument) return

        setProcessingIds(prev => new Set(prev).add(selectedDocument.id))

        try {
            const { data: { session } } = await supabase.auth.getSession()
            
            const response = await fetch(`/api/admin/documents?id=${selectedDocument.id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${session?.access_token || ''}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: editForm.title,
                    category: editForm.category,
                    tags: editForm.tags,
                    source_type: editForm.source_type,
                    metadata: editForm.metadata
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to update document')
            }

            // Update the selected document with the new data
            setSelectedDocument(prev => prev ? {
                ...prev,
                title: editForm.title,
                category: editForm.category,
                tags: editForm.tags,
                source_type: editForm.source_type as 'pubmed' | 'clinical_trial' | 'medical_journal' | 'manual_upload',
                metadata: editForm.metadata
            } : null)
            
            setActiveTab('view')
            await loadDocuments()
        } catch (error) {
            console.error('Error updating document:', error)
            setError(error instanceof Error ? error.message : 'Failed to update document')
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev)
                newSet.delete(selectedDocument.id)
                return newSet
            })
        }
    }

    const deleteDocument = async (documentId: string) => {
        if (!confirm('Are you sure you want to permanently delete this document? This action cannot be undone and will remove all document chunks.')) {
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

            // Close modal if the deleted document was being viewed
            if (selectedDocument?.id === documentId) {
                setShowContentModal(false)
                setSelectedDocument(null)
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

    const openDocumentModal = (document: DocumentWithUploader, tab: 'view' | 'edit' = 'view') => {
        setSelectedDocument(document)
        setActiveTab(tab)
        setShowContentModal(true)
        
        // If opening edit tab, prepare edit form
        if (tab === 'edit') {
            setEditForm({
                title: document.title || '',
                category: document.category || '',
                tags: document.tags || [],
                source_type: document.source_type || '',
                metadata: document.metadata || {}
            })
        }
    }

    const closeDocumentModal = () => {
        setSelectedDocument(null)
        setShowContentModal(false)
        setActiveTab('view')
        setEditForm({
            title: '',
            category: '',
            tags: [],
            source_type: '',
            metadata: {}
        })
    }

    const switchToEditTab = () => {
        if (selectedDocument) {
            setEditForm({
                title: selectedDocument.title || '',
                category: selectedDocument.category || '',
                tags: selectedDocument.tags || [],
                source_type: selectedDocument.source_type || '',
                metadata: selectedDocument.metadata || {}
            })
            setActiveTab('edit')
        }
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

    const handleEditFormChange = (field: keyof typeof editForm, value: string | string[]) => {
        setEditForm(prev => ({ ...prev, [field]: value }))
    }

    const addEditTag = () => {
        const tagInput = (document.getElementById('editTagInput') as HTMLInputElement)?.value?.trim()
        if (tagInput && !editForm.tags.includes(tagInput)) {
            setEditForm(prev => ({
                ...prev,
                tags: [...prev.tags, tagInput]
            }))
            if (tagInput) {
                ;(document.getElementById('editTagInput') as HTMLInputElement).value = ''
            }
        }
    }

    const removeEditTag = (tagToRemove: string) => {
        setEditForm(prev => ({
            ...prev,
            tags: prev.tags.filter(tag => tag !== tagToRemove)
        }))
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
                                                                onClick={() => approveDocument(document.id)}
                                                                disabled={processingIds.has(document.id)}
                                                                className="bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-medium hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {processingIds.has(document.id) ? '...' : 'Approve'}
                                                            </button>
                                                            <button
                                                                onClick={() => rejectDocument(document.id)}
                                                                disabled={processingIds.has(document.id)}
                                                                className="bg-red-100 text-red-700 px-3 py-1 rounded text-xs font-medium hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {processingIds.has(document.id) ? '...' : 'Reject'}
                                                            </button>
                                                        </>
                                                    )}
                                                    {document.status === 'approved' && (
                                                        <>
                                                            <button
                                                                onClick={() => openDocumentModal(document, 'edit')}
                                                                disabled={processingIds.has(document.id)}
                                                                className="bg-orange-100 text-orange-700 px-3 py-1 rounded text-xs font-medium hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {processingIds.has(document.id) ? '...' : 'Edit'}
                                                            </button>
                                                        </>
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
                        <div className="p-6 border-b">
                            <div className="flex items-center justify-between mb-4">
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
                            
                            {/* Tabs */}
                            <div className="flex border-b border-gray-200">
                                <button
                                    onClick={() => setActiveTab('view')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                        activeTab === 'view'
                                            ? 'border-orange-primary text-orange-600'
                                            : 'border-transparent text-medium-gray hover:text-dark-gray'
                                    }`}
                                >
                                    <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    View Content
                                </button>
                                {selectedDocument.status === 'approved' && (
                                    <button
                                        onClick={switchToEditTab}
                                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                            activeTab === 'edit'
                                                ? 'border-orange-primary text-orange-600'
                                                : 'border-transparent text-medium-gray hover:text-dark-gray'
                                        }`}
                                    >
                                        <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Edit Document
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 p-6 overflow-y-auto">
                            {activeTab === 'view' ? (
                                // View Content Tab
                                <div>
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
                            ) : (
                                // Edit Document Tab
                                <div className="space-y-6">
                                    {/* Title */}
                                    <div>
                                        <label className="block text-sm font-medium text-dark-gray mb-1">
                                            Document Title *
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm.title}
                                            onChange={(e) => handleEditFormChange('title', e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none transition-all duration-200"
                                            placeholder="Enter document title"
                                            required
                                        />
                                    </div>

                                    {/* Category */}
                                    <div>
                                        <label className="block text-sm font-medium text-dark-gray mb-1">
                                            Category
                                        </label>
                                        <select
                                            value={editForm.category}
                                            onChange={(e) => handleEditFormChange('category', e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none transition-all duration-200"
                                        >
                                            <option value="">Select category</option>
                                            {DOCUMENT_CATEGORIES.map(category => (
                                                <option key={category} value={category}>
                                                    {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Source Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-dark-gray mb-1">
                                            Source Type
                                        </label>
                                        <select
                                            value={editForm.source_type}
                                            onChange={(e) => handleEditFormChange('source_type', e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none transition-all duration-200"
                                        >
                                            <option value="manual_upload">Manual Upload</option>
                                            <option value="pubmed">PubMed</option>
                                            <option value="clinical_trial">Clinical Trial</option>
                                            <option value="medical_journal">Medical Journal</option>
                                        </select>
                                    </div>

                                    {/* Tags */}
                                    <div>
                                        <label className="block text-sm font-medium text-dark-gray mb-1">
                                            Tags
                                        </label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {editForm.tags.map((tag, index) => (
                                                <span
                                                    key={index}
                                                    className="inline-flex items-center bg-cream-100 text-dark-gray px-3 py-1 rounded-full text-sm"
                                                >
                                                    {tag}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeEditTag(tag)}
                                                        className="ml-2 text-medium-gray hover:text-red-600"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                id="editTagInput"
                                                type="text"
                                                placeholder="Add a tag"
                                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none transition-all duration-200"
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        addEditTag()
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={addEditTag}
                                                className="bg-orange-light text-dark-gray px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t bg-gray-50">
                            {activeTab === 'view' ? (
                                // View tab footer - document actions
                                <div className="flex justify-between items-center">
                                    <div className="flex space-x-2">
                                        {selectedDocument.status === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        approveDocument(selectedDocument.id)
                                                        closeDocumentModal()
                                                    }}
                                                    disabled={processingIds.has(selectedDocument.id)}
                                                    className="bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {processingIds.has(selectedDocument.id) ? 'Processing...' : 'Approve'}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        rejectDocument(selectedDocument.id)
                                                        closeDocumentModal()
                                                    }}
                                                    disabled={processingIds.has(selectedDocument.id)}
                                                    className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {processingIds.has(selectedDocument.id) ? 'Processing...' : 'Reject'}
                                                </button>
                                            </>
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
                                        className="bg-orange-light text-dark-gray px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                                    >
                                        Close
                                    </button>
                                </div>
                            ) : (
                                // Edit tab footer - save/cancel
                                <div className="flex justify-end space-x-4">
                                    <button
                                        onClick={() => setActiveTab('view')}
                                        className="bg-orange-light text-dark-gray px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={saveDocumentEdit}
                                        disabled={!editForm.title.trim() || processingIds.has(selectedDocument.id)}
                                        className="bg-orange-primary text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {processingIds.has(selectedDocument.id) ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}


        </div>
    )
}
