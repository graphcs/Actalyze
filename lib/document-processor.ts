// Document Processing Pipeline for RAG System
import { createClient } from '@supabase/supabase-js'
import {
    Document,
    DocumentChunk,
    DocumentUploadData,
    DocumentProcessingOptions,
    ChunkingOptions,
    DEFAULT_CHUNKING_OPTIONS,
    MAX_FILE_SIZE,
    SUPPORTED_FILE_TYPES
} from '@/types/rag'
import OpenAI from 'openai'
import mammoth from 'mammoth'
import pdf from 'pdf-parse'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

// Create server-side Supabase client with service role key for elevated permissions
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

/**
 * Validate uploaded file
 */
export function validateFile(file: File): { isValid: boolean; error?: string } {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        return {
            isValid: false,
            error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed size (${MAX_FILE_SIZE / 1024 / 1024}MB)`
        }
    }

    // Get file type by MIME type or extension
    const fileType = getFileType(file)
    if (!fileType) {
        return {
            isValid: false,
            error: `File type "${file.type}" is not supported. Supported types: pdf, txt, md, docx`
        }
    }

    return { isValid: true }
}

/**
 * Determine file type from MIME type and file extension
 */
function getFileType(file: File): string | null {
    const fileName = file.name.toLowerCase()

    // Check file extension first (more reliable than MIME type for these formats)
    if (fileName.endsWith('.pdf')) return 'pdf'
    if (fileName.endsWith('.txt')) return 'txt'
    if (fileName.endsWith('.md') || fileName.endsWith('.markdown')) return 'md'
    if (fileName.endsWith('.docx')) return 'docx'

    // Fallback to MIME type
    const mimeType = SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES]
    if (mimeType && mimeType !== 'unknown') {
        return mimeType
    }

    return null
}

/**
 * Extract text content from uploaded file
 */
export async function extractTextFromFile(file: File): Promise<{ text: string; error?: string; metadata?: Record<string, unknown> }> {
    try {
        // Validate file before processing
        const validation = validateFile(file)
        if (!validation.isValid) {
            return { text: '', error: validation.error }
        }

        const fileType = getFileType(file)

        if (!fileType) {
            return {
                text: '',
                error: `Unsupported file type "${file.type}". Supported formats: PDF, TXT, MD, DOCX`
            }
        }

        console.log(`Processing ${fileType.toUpperCase()} file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)

        let result: { text: string; error?: string; metadata?: Record<string, unknown> }

        switch (fileType) {
            case 'txt':
            case 'md':
                result = await extractTextFile(file)
                break

            case 'pdf':
                result = await extractPDFText(file)
                break

            case 'docx':
                result = await extractDOCXText(file)
                break

            default:
                return { text: '', error: `Unsupported file type: ${fileType}` }
        }

        // Validate extracted text
        if (result.text && result.text.trim().length > 0) {
            // Check for minimum meaningful content
            if (result.text.trim().length < 10) {
                return {
                    text: '',
                    error: 'Extracted text is too short. The file may be empty or contain only formatting.'
                }
            }

            // Check for maximum content length
            if (result.text.length > 1000000) { // 1MB of text
                console.warn(`Large document processed: ${result.text.length} characters`)
            }

            console.log(`Successfully extracted ${result.text.length} characters from ${file.name}`)
        }

        return result

    } catch (error) {
        console.error('Error extracting text from file:', error)

        let errorMessage = 'Failed to extract text from file'
        if (error instanceof Error) {
            if (error.message.includes('NetworkError')) {
                errorMessage = 'Network error while processing file. Please try again.'
            } else if (error.message.includes('QuotaExceededError')) {
                errorMessage = 'File is too large to process. Please try a smaller file.'
            }
        }

        return { text: '', error: errorMessage }
    }
}

/**
 * Extract text from plain text files (TXT, MD)
 */
async function extractTextFile(file: File): Promise<{ text: string; error?: string }> {
    try {
        const text = await file.text()

        if (!text || text.trim().length === 0) {
            return {
                text: '',
                error: 'File appears to be empty or contains no readable text.'
            }
        }

        // Basic text cleanup
        const cleanedText = text
            .replace(/\r\n/g, '\n') // Normalize line endings
            .replace(/\r/g, '\n')   // Handle old Mac line endings
            .trim()

        return { text: cleanedText }

    } catch (error) {
        console.error('Text file processing error:', error)
        return {
            text: '',
            error: 'Failed to read text file. The file may be corrupted or use an unsupported encoding.'
        }
    }
}

/**
 * Extract text from PDF files using pdf-parse library
 */
async function extractPDFText(file: File): Promise<{ text: string; error?: string; metadata?: Record<string, unknown> }> {
    try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Use pdf-parse library for robust PDF text extraction
        const data = await pdf(buffer)

        if (!data.text || data.text.trim().length === 0) {
            return {
                text: '',
                error: 'No readable text found in PDF. The PDF might be image-based, encrypted, or corrupted. Please try converting to text format first.'
            }
        }

        // Clean up the extracted text while preserving paragraph structure
        const cleanedText = data.text
            .replace(/\r\n/g, '\n') // Normalize line endings
            .replace(/\r/g, '\n')   // Handle old Mac line endings
            .replace(/[ \t]+/g, ' ') // Normalize spaces and tabs but keep newlines
            .replace(/\n[ \t]+/g, '\n') // Remove leading spaces/tabs from lines
            .replace(/[ \t]+\n/g, '\n') // Remove trailing spaces/tabs from lines
            .replace(/\n{3,}/g, '\n\n') // Replace 3+ consecutive newlines with 2
            .trim()

        // Debug: Check paragraph structure
        const paragraphCount = cleanedText.split(/\n\s*\n/).filter(p => p.trim().length > 0).length
        console.log(`PDF processed successfully: ${data.numpages} pages, ${cleanedText.length} characters extracted, ${paragraphCount} paragraphs detected`)

        return {
            text: cleanedText,
            // Optional: include metadata
            metadata: {
                pages: data.numpages,
                info: data.info,
                version: data.version
            }
        }

    } catch (error) {
        console.error('PDF processing error:', error)

        // Provide specific error messages based on error type
        let errorMessage = 'Failed to process PDF file.'

        if (error instanceof Error) {
            if (error.message.includes('Invalid PDF')) {
                errorMessage = 'Invalid PDF file format. Please ensure the file is a valid PDF.'
            } else if (error.message.includes('encrypted')) {
                errorMessage = 'PDF is password-protected or encrypted. Please provide an unprotected version.'
            } else if (error.message.includes('damaged')) {
                errorMessage = 'PDF file appears to be corrupted. Please try re-saving the file.'
            }
        }

        return {
            text: '',
            error: `${errorMessage} Please try converting to text format first.`
        }
    }
}

/**
 * Extract text from DOCX files using mammoth library
 */
async function extractDOCXText(file: File): Promise<{ text: string; error?: string; metadata?: Record<string, unknown> }> {
    try {
        const arrayBuffer = await file.arrayBuffer()

        // Convert ArrayBuffer to Buffer for mammoth
        const buffer = Buffer.from(arrayBuffer)

        // Use mammoth library for robust DOCX text extraction
        const result = await mammoth.extractRawText({ buffer: buffer })

        if (!result.value || result.value.trim().length === 0) {
            return {
                text: '',
                error: 'No readable text found in DOCX file. The document might be empty, corrupted, or contain only images. Please try saving as .txt or .md format first.'
            }
        }

        // Clean up the extracted text while preserving paragraph structure
        const cleanedText = result.value
            .replace(/\r\n/g, '\n') // Normalize line endings
            .replace(/\r/g, '\n')   // Handle old Mac line endings
            .replace(/[ \t]+/g, ' ') // Normalize spaces and tabs but keep newlines
            .replace(/\n[ \t]+/g, '\n') // Remove leading spaces/tabs from lines
            .replace(/[ \t]+\n/g, '\n') // Remove trailing spaces/tabs from lines
            .replace(/\n{3,}/g, '\n\n') // Replace 3+ consecutive newlines with 2
            .trim()

        // Log any conversion messages/warnings from mammoth
        if (result.messages && result.messages.length > 0) {
            console.log('DOCX conversion messages:', result.messages.map(m => m.message))
        }

        // Debug: Check paragraph structure
        const paragraphCount = cleanedText.split(/\n\s*\n/).filter(p => p.trim().length > 0).length
        console.log(`DOCX processed successfully: ${cleanedText.length} characters extracted, ${paragraphCount} paragraphs detected`)

        return {
            text: cleanedText,
            // Include any conversion warnings as metadata
            metadata: {
                messages: result.messages || [],
                hasWarnings: result.messages?.some(m => m.type === 'warning') || false
            }
        }

    } catch (error) {
        console.error('DOCX processing error:', error)

        // Provide specific error messages based on error type
        let errorMessage = 'Failed to process DOCX file.'

        if (error instanceof Error) {
            if (error.message.includes('not a valid zip file')) {
                errorMessage = 'Invalid DOCX file format. The file may be corrupted or not a valid Word document.'
            } else if (error.message.includes('Cannot read')) {
                errorMessage = 'Unable to read DOCX file. The file may be corrupted or use an unsupported format.'
            } else if (error.message.includes('password')) {
                errorMessage = 'DOCX file is password-protected. Please provide an unprotected version.'
            }
        }

        return {
            text: '',
            error: `${errorMessage} Please try saving as .txt or .md format first.`
        }
    }
}

/**
 * Split text into chunks for vector embeddings
 */
export function chunkText(
    text: string,
    options: ChunkingOptions = DEFAULT_CHUNKING_OPTIONS
): { content: string; start_char: number; end_char: number; metadata: Record<string, unknown> }[] {
    const { chunk_size, overlap, preserve_paragraphs } = options
    const chunks: { content: string; start_char: number; end_char: number; metadata: Record<string, unknown> }[] = []

    if (preserve_paragraphs) {
        // Split by paragraphs first
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
        let currentChunk = ''
        let chunkStartChar = 0
        let currentPosition = 0

        for (const paragraph of paragraphs) {
            const paragraphWithNewlines = paragraph.trim() + '\n\n'

            // If adding this paragraph would exceed chunk size, save current chunk
            if (currentChunk.length + paragraphWithNewlines.length > chunk_size && currentChunk.length > 0) {
                chunks.push({
                    content: currentChunk.trim(),
                    start_char: chunkStartChar,
                    end_char: chunkStartChar + currentChunk.length,
                    metadata: {
                        paragraph_count: currentChunk.split('\n\n').filter(p => p.trim().length > 0).length,
                        chunk_method: 'paragraph_based'
                    }
                })

                // Start new chunk with overlap
                const overlapText = currentChunk.slice(-overlap) || ''
                currentChunk = overlapText + paragraphWithNewlines
                chunkStartChar = currentPosition - overlapText.length
            } else {
                currentChunk += paragraphWithNewlines
            }

            currentPosition += paragraphWithNewlines.length
        }

        // Add final chunk
        if (currentChunk.trim().length > 0) {
            chunks.push({
                content: currentChunk.trim(),
                start_char: chunkStartChar,
                end_char: chunkStartChar + currentChunk.length,
                metadata: {
                    paragraph_count: currentChunk.split('\n\n').filter(p => p.trim().length > 0).length,
                    chunk_method: 'paragraph_based'
                }
            })
        }
    } else {
        // Simple character-based chunking
        for (let i = 0; i < text.length; i += chunk_size - overlap) {
            const end = Math.min(i + chunk_size, text.length)
            const content = text.slice(i, end)

            chunks.push({
                content,
                start_char: i,
                end_char: end,
                metadata: {
                    chunk_method: 'character_based'
                }
            })

            if (end >= text.length) break
        }
    }

    return chunks
}

/**
 * Generate embeddings for text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<{ embedding: number[]; error?: string }> {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-large",
            input: text.replace(/\n/g, ' ').trim(),
            dimensions: 1536 // Reduce to 1536 for compatibility with IVFFlat
        })

        return { embedding: response.data[0].embedding }
    } catch (error) {
        console.error('Error generating embedding:', error)
        return {
            embedding: [],
            error: error instanceof Error ? error.message : 'Unknown error generating embedding'
        }
    }
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadFileToStorage(
    file: File,
    documentId: string
): Promise<{ url: string; error?: string }> {
    try {
        const fileName = `${documentId}_${file.name}`
        const { data, error } = await supabase.storage
            .from('documents')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            })

        if (error) {
            return { url: '', error: error.message }
        }

        const { data: urlData } = supabase.storage
            .from('documents')
            .getPublicUrl(data.path)

        return { url: urlData.publicUrl }
    } catch (error) {
        console.error('Error uploading file to storage:', error)
        return {
            url: '',
            error: error instanceof Error ? error.message : 'Unknown storage error'
        }
    }
}

/**
 * Save document to database
 */
export async function saveDocument(
    uploadData: DocumentUploadData,
    content: string,
    fileUrl?: string
): Promise<{ document: Document; error?: string }> {
    try {
        const documentRecord = {
            title: uploadData.title,
            content: content,
            file_url: fileUrl,
            file_name: uploadData.file?.name,
            file_type: uploadData.file?.type,
            file_size: uploadData.file?.size,
            source_type: uploadData.source_type,
            category: uploadData.category,
            jurisdiction: uploadData.jurisdiction,
            year: uploadData.year,
            bill_number: uploadData.bill_number,
            case_citation: uploadData.case_citation,
            metadata: uploadData.metadata,
            status: 'active' as const,
            upload_status: 'completed' as const
        }

        const { data, error } = await supabase
            .from('documents')
            .insert(documentRecord)
            .select()
            .single()

        if (error) {
            return { document: {} as Document, error: error.message }
        }

        return { document: data as Document }
    } catch (error) {
        console.error('Error saving document:', error)
        return {
            document: {} as Document,
            error: error instanceof Error ? error.message : 'Unknown database error'
        }
    }
}

/**
 * Save document chunks with embeddings
 */
export async function saveDocumentChunks(
    documentId: string,
    chunks: { content: string; start_char: number; end_char: number; metadata: Record<string, unknown> }[]
): Promise<{ success: boolean; error?: string }> {
    try {
        const chunksWithEmbeddings: Partial<DocumentChunk>[] = []

        // Generate embeddings for each chunk
        console.log(`Generating embeddings for ${chunks.length} chunks...`)
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]
            console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunk.content.length} chars)`)
            const { embedding, error } = await generateEmbedding(chunk.content)

            if (error) {
                console.error(`Failed to generate embedding for chunk ${i}:`, error)
                console.error(`Chunk content preview:`, chunk.content.slice(0, 100) + '...')
                continue // Skip this chunk but continue processing others
            }
            console.log(`Successfully generated embedding for chunk ${i + 1}`)

            chunksWithEmbeddings.push({
                document_id: documentId,
                content: chunk.content,
                chunk_index: i,
                chunk_size: chunk.content.length,
                start_char: chunk.start_char,
                end_char: chunk.end_char,
                embedding: embedding,
                metadata: chunk.metadata
            })
        }

        if (chunksWithEmbeddings.length === 0) {
            console.error('No valid chunks with embeddings could be processed')
            return { success: false, error: 'No valid chunks could be processed' }
        }

        console.log(`Inserting ${chunksWithEmbeddings.length} chunks into database...`)
        const { error } = await supabase
            .from('document_chunks')
            .insert(chunksWithEmbeddings)

        if (error) {
            console.error('Database insertion error:', error)
            return { success: false, error: error.message }
        }
        console.log(`Successfully inserted ${chunksWithEmbeddings.length} chunks into database`)

        // Update document status to completed
        await supabase
            .from('documents')
            .update({ upload_status: 'completed' })
            .eq('id', documentId)

        return { success: true }
    } catch (error) {
        console.error('Error saving document chunks:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error saving chunks'
        }
    }
}

/**
 * Main document processing function
 */
export async function processDocument(
    uploadData: DocumentUploadData,
    options: DocumentProcessingOptions = {
        chunking: DEFAULT_CHUNKING_OPTIONS,
        generate_embeddings: true,
        auto_approve: false
    }
): Promise<{ documentId: string; success: boolean; error?: string }> {
    try {
        let content = ''
        let fileUrl: string | undefined

        // Extract content
        if (uploadData.file) {
            // Validate file first
            const validation = validateFile(uploadData.file)
            if (!validation.isValid) {
                return { documentId: '', success: false, error: validation.error }
            }

            // Extract text from file
            const { text, error: extractError } = await extractTextFromFile(uploadData.file)
            if (extractError) {
                return { documentId: '', success: false, error: extractError }
            }
            content = text
        } else if (uploadData.content) {
            content = uploadData.content
        } else {
            return { documentId: '', success: false, error: 'No content or file provided' }
        }

        if (content.trim().length === 0) {
            return { documentId: '', success: false, error: 'Document content is empty' }
        }

        // Save document to database first
        const { document, error: saveError } = await saveDocument(uploadData, content, fileUrl)
        if (saveError) {
            return { documentId: '', success: false, error: saveError }
        }

        // Upload file to storage if provided
        if (uploadData.file) {
            const { url, error: uploadError } = await uploadFileToStorage(uploadData.file, document.id)
            if (uploadError) {
                console.warn('File upload failed, but continuing with text processing:', uploadError)
            } else {
                fileUrl = url
                // Update document with file URL
                await supabase
                    .from('documents')
                    .update({ file_url: fileUrl })
                    .eq('id', document.id)
            }
        }

        // Process chunks and generate embeddings
        if (options.generate_embeddings) {
            console.log(`Processing document "${document.title}" (${content.length} chars)`)
            const chunks = chunkText(content, options.chunking)
            console.log(`Generated ${chunks.length} chunks:`, chunks.map(c => c.content.length))

            if (chunks.length === 0) {
                console.error('No chunks generated for document:', document.id)
                return { documentId: document.id, success: false, error: 'No chunks could be generated from content' }
            }

            const { success: chunkSuccess, error: chunkError } = await saveDocumentChunks(document.id, chunks)
            if (!chunkSuccess) {
                console.error('Failed to save chunks for document:', document.id, chunkError)
                return { documentId: document.id, success: false, error: chunkError }
            }
            console.log(`Successfully saved ${chunks.length} chunks for document:`, document.id)
        }

        // Auto-approve if enabled (no longer requires auth)
        if (options.auto_approve) {
            await supabase
                .from('documents')
                .update({
                    status: 'active',
                    updated_at: new Date().toISOString()
                })
                .eq('id', document.id)
        }

        return { documentId: document.id, success: true }
    } catch (error) {
        console.error('Error processing document:', error)
        return {
            documentId: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown processing error'
        }
    }
}

/**
 * Search for relevant document chunks using vector similarity
 */
export async function searchDocuments(
    query: string,
    options: {
        limit?: number
        threshold?: number
        categories?: string[]
        source_types?: string[]
    } = {}
): Promise<{ results: Record<string, unknown>[]; error?: string }> {
    try {
        const {
            limit = 10,
            threshold = 0.3, // Balanced threshold for good matches
            categories = [],
            source_types = []
        } = options

        console.log('🔍 Starting document search:', { query, limit, threshold })

        // Generate embedding for query
        const { embedding, error: embeddingError } = await generateEmbedding(query)
        if (embeddingError) {
            console.error('❌ Embedding generation failed:', embeddingError)
            return { results: [], error: embeddingError }
        }
        console.log('✅ Generated embedding for query')

        // Call the search function
        console.log('🔍 Calling search_documents with:', {
            embedding_length: embedding.length,
            match_threshold: threshold,
            match_count: limit
        })

        const { data, error } = await supabase.rpc('search_documents', {
            query_embedding: embedding,
            match_threshold: threshold,
            match_count: limit
        })

        if (error) {
            console.error('❌ Database search failed:', error)
            console.error('Error details:', error)
            return { results: [], error: error.message }
        }

        console.log('📊 Raw search results:', {
            count: data?.length || 0,
            threshold,
            hasData: !!data
        })

        // Filter by categories and source types if specified
        let results = data || []

        if (categories.length > 0) {
            results = results.filter((r: Record<string, unknown>) =>
                r.document_category && typeof r.document_category === 'string' && categories.includes(r.document_category)
            )
            console.log('🏷️ Filtered by categories:', { before: data?.length, after: results.length })
        }

        if (source_types.length > 0) {
            results = results.filter((r: Record<string, unknown>) =>
                r.document_source_type && typeof r.document_source_type === 'string' && source_types.includes(r.document_source_type)
            )
            console.log('📝 Filtered by source types:', { before: data?.length, after: results.length })
        }

        console.log('🎯 Final search results:', {
            count: results.length,
            titles: results.map((r: Record<string, unknown>) => r.document_title as string).slice(0, 3)
        })

        return { results }
    } catch (error) {
        console.error('Error searching documents:', error)
        return {
            results: [],
            error: error instanceof Error ? error.message : 'Unknown search error'
        }
    }
}
