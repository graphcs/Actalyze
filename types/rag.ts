// RAG (Retrieval-Augmented Generation) Type Definitions for Actalyze
// US Legislation Document Management System

export interface Document {
    id: string
    title: string
    content: string
    file_url?: string
    file_name?: string
    file_type?: string
    file_size?: number
    source_type: 'federal_law' | 'state_law' | 'regulation' | 'case_law' | 'bill'
    category?: string
    metadata: Record<string, any>
    status: 'active' | 'archived'
    upload_status: 'processing' | 'completed' | 'failed'
    processing_error?: string
    version: number
    is_active: boolean
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

// Chat message for single session (no persistence)
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: string
    sources?: Array<{
        title: string
        category?: string
        relevanceScore: number
    }>
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
    metadata: Record<string, any>
    jurisdiction?: string // e.g., "Federal", "California", "New York"
    year?: number
    bill_number?: string
    case_citation?: string
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

// Document Statistics
export interface DocumentStats {
    total_documents: number
    processing_jobs: number
    storage_used: number // in bytes
    recent_uploads: Document[]
    by_category: Record<string, number>
    by_source_type: Record<string, number>
}

export interface DocumentFilter {
    status?: Document['status']
    source_type?: Document['source_type']
    category?: string
    search_query?: string
    jurisdiction?: string
    year?: number
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

// Constants for US Legislation
export const DOCUMENT_CATEGORIES = [
    'constitutional_law',
    'criminal_law',
    'civil_law',
    'administrative_law',
    'tax_law',
    'corporate_law',
    'labor_law',
    'environmental_law',
    'healthcare_law',
    'intellectual_property',
    'immigration_law',
    'general'
] as const

export const SOURCE_TYPES = [
    'federal_law',
    'state_law',
    'regulation',
    'case_law',
    'bill'
] as const

export const DOCUMENT_STATUSES = [
    'active',
    'archived'
] as const

export const US_JURISDICTIONS = [
    'Federal',
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
    'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
    'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
    'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
    'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
    'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
    'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
    'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
    'District of Columbia', 'Puerto Rico'
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
