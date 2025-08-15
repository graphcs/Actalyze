// RAG (Retrieval-Augmented Generation) Type Definitions

export interface Document {
    id: string
    title: string
    content: string
    file_url?: string
    file_name?: string
    file_type?: string
    file_size?: number
    source_type: 'pubmed' | 'clinical_trial' | 'medical_journal' | 'manual_upload'
    category?: string
    tags: string[]
    metadata: Record<string, any>
    status: 'pending' | 'approved' | 'rejected' | 'archived'
    upload_status: 'processing' | 'completed' | 'failed'
    processing_error?: string
    version: number
    is_active: boolean
    uploaded_by?: string
    approved_by?: string
    approved_at?: string
    created_at: string
    updated_at: string
}

export interface DocumentChunk {
    id: string
    document_id: string
    content: string
    chunk_index: number
    chunk_size?: number
    start_char?: number
    end_char?: number
    embedding?: number[] // Vector embedding
    metadata: Record<string, any>
    created_at: string
}

export interface AdminRole {
    id: string
    user_id: string
    role: 'admin' | 'super_admin'
    permissions: string[]
    created_at: string
    updated_at: string
}

export interface ChatConversation {
    id: string
    user_id: string
    title?: string
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface ChatMessage {
    id: string
    conversation_id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    context_sources: string[] // Document IDs used for context
    token_count?: number
    created_at: string
}

export interface DocumentProcessingJob {
    id: string
    document_id: string
    job_type: 'extract_text' | 'generate_embeddings' | 'chunk_document'
    status: 'pending' | 'processing' | 'completed' | 'failed'
    progress: number // 0-100
    error_message?: string
    started_at?: string
    completed_at?: string
    created_at: string
}

export interface SearchResult {
    document_id: string
    chunk_id: string
    content: string
    similarity: number
    document_title: string
    document_category?: string
    document_source_type: string
    // Additional document metadata
    document?: Document
}

export interface DocumentUploadData {
    title: string
    file?: File
    content?: string // For manual text entry
    source_type: Document['source_type']
    category?: string
    tags: string[]
    metadata: Record<string, any>
}

export interface EmbeddingResponse {
    embedding: number[]
    error?: string
}

export interface ChunkingOptions {
    chunk_size: number
    overlap: number
    preserve_paragraphs: boolean
}

export interface DocumentProcessingOptions {
    chunking: ChunkingOptions
    generate_embeddings: boolean
    auto_approve: boolean
}

// Admin Dashboard Types
export interface AdminDashboardStats {
    total_documents: number
    pending_approval: number
    processing_jobs: number
    storage_used: number // in bytes
    recent_uploads: Document[]
}

export interface DocumentFilter {
    status?: Document['status']
    source_type?: Document['source_type']
    category?: string
    search_query?: string
    uploaded_by?: string
    date_range?: {
        start: string
        end: string
    }
}

// Error types
export interface RAGError {
    type: 'upload_error' | 'processing_error' | 'embedding_error' | 'search_error'
    message: string
    details?: Record<string, any>
}

// API Response types
export interface DocumentUploadResponse {
    success: boolean
    document_id?: string
    processing_jobs?: string[]
    error?: RAGError
}

export interface DocumentSearchResponse {
    success: boolean
    results: SearchResult[]
    total_results: number
    query_embedding?: number[]
    error?: RAGError
}

export interface AdminActionResponse {
    success: boolean
    affected_count?: number
    error?: RAGError
}

// Constants
export const DOCUMENT_CATEGORIES = [
    'gut_health',
    'nutrition',
    'supplements',
    'probiotics',
    'digestive_disorders',
    'microbiome',
    'diet_therapy',
    'clinical_trials',
    'general'
] as const

export const SOURCE_TYPES = [
    'pubmed',
    'clinical_trial',
    'medical_journal',
    'manual_upload'
] as const

export const DOCUMENT_STATUSES = [
    'pending',
    'approved',
    'rejected',
    'archived'
] as const

export const ADMIN_PERMISSIONS = [
    'upload',
    'delete',
    'edit',
    'approve',
    'manage_users'
] as const

// Default chunking configuration
export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
    chunk_size: 800,
    overlap: 200,
    preserve_paragraphs: true
}

// Supported file types
export const SUPPORTED_FILE_TYPES = {
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'text/markdown': 'md',
    'text/x-markdown': 'md',
    'application/octet-stream': 'unknown', // Will be handled by file extension
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
} as const

export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
export const MAX_DOCUMENT_LENGTH = 1000000 // 1M characters
