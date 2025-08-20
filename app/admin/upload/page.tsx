'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DocumentUploadData, DOCUMENT_CATEGORIES, SOURCE_TYPES } from '@/types/rag'

export default function DocumentUploadPage() {
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const router = useRouter()

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        source_type: 'manual_upload' as const,
        category: '',
        tags: [] as string[],
        metadata: {} as Record<string, unknown>
    })
    const [file, setFile] = useState<File | null>(null)
    const [uploadMode, setUploadMode] = useState<'file' | 'text'>('file')
    const [tagInput, setTagInput] = useState('')

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

            // Check for upload_documents permission
            const permissions = Array.isArray(adminCheck.permissions) 
                ? adminCheck.permissions 
                : JSON.parse(adminCheck.permissions as unknown as string || '[]')

            if (!permissions.includes('upload_documents')) {
                setIsAdmin(false)
                setError('Upload Documents permission required')
                setLoading(false)
                return
            }

            setIsAdmin(true)
        } catch (error) {
            console.error('Error checking admin access:', error)
            setError('Failed to verify admin access')
        } finally {
            setLoading(false)
        }
    }

    const handleInputChange = (field: keyof typeof formData, value: string | string[]) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] || null
        setFile(selectedFile)
        
        // Auto-fill title from filename if empty
        if (selectedFile && !formData.title) {
            const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '')
            setFormData(prev => ({ ...prev, title: nameWithoutExt }))
        }
    }

    const handleFileRemove = () => {
        setFile(null)
        // Clear the file input
        const fileInput = document.getElementById('fileInput') as HTMLInputElement
        if (fileInput) {
            fileInput.value = ''
        }
    }

    const addTag = () => {
        if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
            setFormData(prev => ({
                ...prev,
                tags: [...prev.tags, tagInput.trim()]
            }))
            setTagInput('')
        }
    }

    const removeTag = (tagToRemove: string) => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags.filter(tag => tag !== tagToRemove)
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(null)
        setUploading(true)

        try {
            // Validation
            if (!formData.title.trim()) {
                throw new Error('Title is required')
            }

            if (uploadMode === 'file' && !file) {
                throw new Error('Please select a file to upload')
            }

            if (uploadMode === 'text' && !formData.content.trim()) {
                throw new Error('Content is required')
            }

            // Prepare form data for upload
            const uploadFormData = new FormData()
            uploadFormData.append('title', formData.title.trim())
            uploadFormData.append('source_type', formData.source_type)
            uploadFormData.append('category', formData.category)
            uploadFormData.append('tags', JSON.stringify(formData.tags))
            uploadFormData.append('metadata', JSON.stringify(formData.metadata))

            if (uploadMode === 'file' && file) {
                uploadFormData.append('file', file)
            } else {
                uploadFormData.append('content', formData.content.trim())
            }

            // Upload document
            const { data: { session } } = await supabase.auth.getSession()
            
            const response = await fetch('/api/admin/documents/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token || ''}`
                },
                body: uploadFormData
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Upload failed')
            }

            setSuccess('Document uploaded successfully! It is now pending approval.')
            
            // Reset form
            setFormData({
                title: '',
                content: '',
                source_type: 'manual_upload',
                category: '',
                tags: [],
                metadata: {}
            })
            setFile(null)
            
            // Reset file input
            const fileInput = document.getElementById('fileInput') as HTMLInputElement
            if (fileInput) fileInput.value = ''

        } catch (error) {
            console.error('Upload error:', error)
            setError(error instanceof Error ? error.message : 'Upload failed')
        } finally {
            setUploading(false)
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
                    <p className="text-medium-gray mb-6">{error || 'Upload permission required.'}</p>
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
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-4">
                            <Link href="/admin">
                                <h1 className="brand-title text-2xl font-bold text-dark-green">GutRoot</h1>
                            </Link>
                            <span className="text-medium-gray">|</span>
                            <h2 className="text-xl font-semibold text-dark-gray">Upload Document</h2>
                        </div>
                        <Link 
                            href="/admin"
                            className="text-medium-gray hover:text-dark-gray transition-colors"
                        >
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-lg shadow">
                    <div className="p-6">
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

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Upload Mode Selection */}
                            <div>
                                <label className="block text-sm font-medium text-dark-gray mb-3">
                                    Upload Method
                                </label>
                                <div className="flex space-x-4">
                                    <button
                                        type="button"
                                        onClick={() => setUploadMode('file')}
                                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                            uploadMode === 'file'
                                                ? 'bg-orange-primary text-white'
                                                : 'bg-gray-100 text-dark-gray hover:bg-gray-200'
                                        }`}
                                    >
                                        Upload File
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setUploadMode('text')}
                                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                            uploadMode === 'text'
                                                ? 'bg-orange-primary text-white'
                                                : 'bg-gray-100 text-dark-gray hover:bg-gray-200'
                                        }`}
                                    >
                                        Enter Text
                                    </button>
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-dark-gray mb-2">
                                    Document Title *
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => handleInputChange('title', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none"
                                    placeholder="Enter document title"
                                    required
                                />
                            </div>

                            {/* File Upload or Text Content */}
                            {uploadMode === 'file' ? (
                                <div>
                                    <label className="block text-sm font-medium text-dark-gray mb-2">
                                        Select File *
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            id="fileInput"
                                            type="file"
                                            onChange={handleFileChange}
                                            accept=".pdf,.txt,.md,.markdown,.docx"
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none"
                                            required
                                        />
                                        {file && (
                                            <button
                                                type="button"
                                                onClick={handleFileRemove}
                                                className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 flex items-center gap-1"
                                                title="Remove selected file"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    {file && (
                                        <p className="text-sm text-green-600 mt-2">
                                            Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                        </p>
                                    )}
                                    <p className="text-sm text-medium-gray mt-1">
                                        Supported formats: PDF, TXT, MD/Markdown, DOCX (max 50MB)
                                        <br />
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-dark-gray mb-2">
                                        Document Content *
                                    </label>
                                    <textarea
                                        value={formData.content}
                                        onChange={(e) => handleInputChange('content', e.target.value)}
                                        rows={12}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none"
                                        placeholder="Paste or type the document content here..."
                                        required
                                    />
                                </div>
                            )}

                            {/* Source Type */}
                            <div>
                                <label className="block text-sm font-medium text-dark-gray mb-2">
                                    Source Type *
                                </label>
                                <select
                                    value={formData.source_type}
                                    onChange={(e) => handleInputChange('source_type', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none"
                                    required
                                >
                                    <option value="manual_upload">Manual Upload</option>
                                    <option value="pubmed">PubMed</option>
                                    <option value="clinical_trial">Clinical Trial</option>
                                    <option value="medical_journal">Medical Journal</option>
                                </select>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-sm font-medium text-dark-gray mb-2">
                                    Category
                                </label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => handleInputChange('category', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none"
                                >
                                    <option value="">Select category</option>
                                    {DOCUMENT_CATEGORIES.map(category => (
                                        <option key={category} value={category}>
                                            {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="block text-sm font-medium text-dark-gray mb-2">
                                    Tags
                                </label>
                                <div className="flex space-x-2 mb-2">
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none"
                                        placeholder="Add a tag"
                                    />
                                    <button
                                        type="button"
                                        onClick={addTag}
                                        className="px-4 py-2 bg-orange-light text-dark-gray rounded-lg font-medium hover:opacity-90 transition-opacity"
                                    >
                                        Add
                                    </button>
                                </div>
                                {formData.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {formData.tags.map((tag, index) => (
                                            <span
                                                key={index}
                                                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800"
                                            >
                                                {tag}
                                                <button
                                                    type="button"
                                                    onClick={() => removeTag(tag)}
                                                    className="ml-2 hover:text-orange-600"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Submit Button */}
                            <div className="flex justify-end space-x-4 pt-6 border-t">
                                <Link
                                    href="/admin"
                                    className="px-6 py-2 border border-gray-300 rounded-lg text-dark-gray font-medium hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </Link>
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="px-6 py-2 bg-orange-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {uploading ? 'Uploading...' : 'Upload Document'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
