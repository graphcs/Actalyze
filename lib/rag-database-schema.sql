-- Actalyze - US Legislation Document RAG System
-- Simplified Database Schema (No Authentication Required)
-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table for storing uploaded US legislation documents
CREATE TABLE documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    file_url TEXT, -- Supabase Storage URL for original file
    file_name TEXT,
    file_type TEXT, -- 'pdf', 'txt', 'docx', 'md'
    file_size BIGINT, -- In bytes
    source_type TEXT NOT NULL, -- 'federal_law', 'state_law', 'regulation', 'case_law', 'bill'
    category TEXT, -- 'constitutional_law', 'criminal_law', 'civil_law', etc.
    metadata JSONB DEFAULT '{}'::jsonb, -- Flexible metadata (jurisdiction, year, bill number, case citation, etc.)
    jurisdiction TEXT, -- e.g., 'Federal', 'California', 'New York'
    year INTEGER, -- Year of enactment/decision
    bill_number TEXT, -- For bills
    case_citation TEXT, -- For case law
    status TEXT DEFAULT 'active', -- 'active', 'archived'
    upload_status TEXT DEFAULT 'processing', -- 'processing', 'completed', 'failed'
    processing_error TEXT, -- Error message if processing failed
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
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
CREATE INDEX idx_documents_jurisdiction ON documents(jurisdiction);
CREATE INDEX idx_documents_year ON documents(year);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_chunk_index ON document_chunks(document_id, chunk_index);

-- Full-text search index for document content
CREATE INDEX idx_documents_content_fts ON documents USING gin(to_tsvector('english', content));
CREATE INDEX idx_document_chunks_content_fts ON document_chunks USING gin(to_tsvector('english', content));

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

-- NO ROW LEVEL SECURITY - Public access
-- All tables are accessible without authentication

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

-- Function for vector similarity search (public access)
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
    document_source_type text,
    document_jurisdiction text,
    document_year integer
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
        d.source_type as document_source_type,
        d.jurisdiction as document_jurisdiction,
        d.year as document_year
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE 
        d.status = 'active' 
        AND d.is_active = true
        AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ALERT SYSTEM TABLES
-- ============================================

-- Alert configurations (what to monitor)
CREATE TABLE alert_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('issue_surge', 'sentiment_shift', 'rep_mention')),
    enabled BOOLEAN DEFAULT true,

    -- Configuration varies by type
    topic TEXT,                          -- For issue_surge, sentiment_shift
    representative_name TEXT,            -- For rep_mention
    district_code TEXT DEFAULT 'national', -- e.g., 'VA05', 'national'
    threshold DECIMAL,                   -- Surge: score threshold (0-100), Sentiment: shift amount (0-1)

    -- Notification settings
    notify_email BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historical baselines (for surge/shift detection)
CREATE TABLE alert_baselines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    topic TEXT NOT NULL,
    district_code TEXT DEFAULT 'national',
    avg_score DECIMAL,                   -- Rolling average score (0-100)
    avg_sentiment DECIMAL,               -- Rolling average sentiment (-1 to 1)
    sample_count INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(topic, district_code)
);

-- Alert history (sent notifications)
CREATE TABLE alert_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    config_id UUID REFERENCES alert_configs(id) ON DELETE SET NULL,
    alert_type TEXT NOT NULL,
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,   -- Topic, score, sentiment, etc.
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    delivery_status TEXT DEFAULT 'sent'
);

-- Indexes for alert tables
CREATE INDEX idx_alert_configs_user ON alert_configs(user_email);
CREATE INDEX idx_alert_configs_type ON alert_configs(alert_type);
CREATE INDEX idx_alert_configs_enabled ON alert_configs(enabled);
CREATE INDEX idx_alert_baselines_topic ON alert_baselines(topic, district_code);
CREATE INDEX idx_alert_history_config ON alert_history(config_id);
CREATE INDEX idx_alert_history_sent ON alert_history(sent_at DESC);

-- Trigger for alert_configs updated_at
CREATE TRIGGER update_alert_configs_updated_at
    BEFORE UPDATE ON alert_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Notes:
-- 1. No authentication required - all tables are publicly accessible
-- 2. Remember to create storage bucket 'legislation-documents' with public read access
-- 3. Update Supabase RLS settings to allow public access if needed
