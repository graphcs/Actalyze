-- RAG (Retrieval-Augmented Generation) Database Schema
-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Admin roles table for managing document upload permissions
CREATE TABLE admin_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    role TEXT NOT NULL DEFAULT 'admin', -- 'admin', 'super_admin'
    permissions JSONB DEFAULT '[]'::jsonb, -- ['upload', 'delete', 'edit', 'approve']
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Documents table for storing uploaded medical content
CREATE TABLE documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    file_url TEXT, -- Supabase Storage URL for original file
    file_name TEXT,
    file_type TEXT, -- 'pdf', 'txt', 'docx', etc.
    file_size BIGINT, -- In bytes
    source_type TEXT NOT NULL, -- 'pubmed', 'clinical_trial', 'medical_journal', 'manual_upload'
    category TEXT, -- 'gut_health', 'nutrition', 'supplements', 'general'
    tags TEXT[] DEFAULT '{}', -- Searchable tags
    metadata JSONB DEFAULT '{}'::jsonb, -- Flexible metadata (authors, publication date, etc.)
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'archived'
    upload_status TEXT DEFAULT 'processing', -- 'processing', 'completed', 'failed'
    processing_error TEXT, -- Error message if processing failed
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    uploaded_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Document chunks for RAG retrieval (split documents into searchable pieces)
CREATE TABLE document_chunks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL, -- Order within document
    chunk_size INTEGER, -- Character count
    start_char INTEGER, -- Position in original document
    end_char INTEGER,
    embedding vector(1536), -- OpenAI text-embedding-3-large with reduced dimensions
    metadata JSONB DEFAULT '{}'::jsonb, -- Page numbers, section titles, etc.
    created_at TIMESTAMP DEFAULT NOW()
);

-- Vector similarity search index
CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Regular indexes for performance
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_source_type ON documents(source_type);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_chunk_index ON document_chunks(document_id, chunk_index);

-- Full-text search index for document content
CREATE INDEX idx_documents_content_fts ON documents USING gin(to_tsvector('english', content));
CREATE INDEX idx_document_chunks_content_fts ON document_chunks USING gin(to_tsvector('english', content));

-- Chat conversations (for future chatbot implementation)
CREATE TABLE chat_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat messages with source tracking
CREATE TABLE chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    context_sources JSONB DEFAULT '[]'::jsonb, -- Array of document IDs used for context
    token_count INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Document processing jobs (for async processing)
CREATE TABLE document_processing_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL, -- 'extract_text', 'generate_embeddings', 'chunk_document'
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    progress INTEGER DEFAULT 0, -- 0-100
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Row Level Security (RLS) Policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
-- NOTE: admin_roles table does NOT have RLS enabled to avoid infinite recursion
-- Access control for admin_roles is handled at the application level
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Admin access for documents
CREATE POLICY "Admins can manage documents" ON documents
    USING (
        auth.uid() IN (
            SELECT user_id FROM admin_roles WHERE permissions ? 'upload' OR role = 'super_admin'
        )
    );

-- Users can read approved documents (for chatbot)
CREATE POLICY "Users can read approved documents" ON documents
    FOR SELECT USING (status = 'approved' AND is_active = true);

-- Document chunks inherit document permissions
CREATE POLICY "Users can read approved document chunks" ON document_chunks
    FOR SELECT USING (
        document_id IN (
            SELECT id FROM documents WHERE status = 'approved' AND is_active = true
        )
    );

-- Admin access for chunks
CREATE POLICY "Admins can manage document chunks" ON document_chunks
    USING (
        auth.uid() IN (
            SELECT user_id FROM admin_roles WHERE permissions ? 'upload' OR role = 'super_admin'
        )
    );

-- Chat conversations - users can only access their own
CREATE POLICY "Users can manage their own conversations" ON chat_conversations
    USING (auth.uid() = user_id);

-- Chat messages - users can only access messages from their conversations
CREATE POLICY "Users can access their own chat messages" ON chat_messages
    USING (
        conversation_id IN (
            SELECT id FROM chat_conversations WHERE user_id = auth.uid()
        )
    );

-- NOTE: No RLS policy on admin_roles to prevent infinite recursion
-- Admin role management is handled at the application level with proper authentication

-- Processing jobs - admins can view
CREATE POLICY "Admins can view processing jobs" ON document_processing_jobs
    USING (
        auth.uid() IN (
            SELECT user_id FROM admin_roles
        )
    );

-- Functions for automatic timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic timestamps
CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at 
    BEFORE UPDATE ON chat_conversations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_roles 
        WHERE user_id = user_uuid 
        AND (permissions ? 'upload' OR role = 'super_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for vector similarity search
CREATE OR REPLACE FUNCTION search_documents(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    document_id uuid,
    chunk_id uuid,
    content text,
    similarity float,
    document_title text,
    document_category text,
    document_source_type text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dc.document_id,
        dc.id as chunk_id,
        dc.content,
        1 - (dc.embedding <=> query_embedding) as similarity,
        d.title as document_title,
        d.category as document_category,
        d.source_type as document_source_type
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE 
        d.status = 'approved' 
        AND d.is_active = true
        AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Initial super admin setup (replace with your user ID)
-- INSERT INTO admin_roles (user_id, role, permissions) 
-- VALUES ('your-user-id-here', 'super_admin', '["upload", "delete", "edit", "approve"]'::jsonb);
