import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { searchDocuments } from '@/lib/document-processor'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!
})

interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
    timestamp: string
}

interface ChatRequest {
    message: string
    history?: ChatMessage[]
}

interface DocumentChunk {
    id: string
    content: string
    document_title: string
    document_category?: string
    document_jurisdiction?: string
    document_year?: number
    similarity: number
    [key: string]: unknown
}

interface DocumentChunksWithList extends Array<DocumentChunk> {
    documentList?: string[]
}

export async function POST(request: NextRequest) {
    try {
        const { message, history = [] }: ChatRequest = await request.json()

        if (!message || typeof message !== 'string') {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 })
        }

        console.log('Processing chatbot request:', { messageLength: message.length })

        // Step 1: Search for relevant legislation documents using RAG
        console.log('Searching for relevant documents...')
        const searchResult = await searchDocuments(message, { limit: 5 })
        console.log('Search result:', {
            resultCount: searchResult.results?.length || 0,
            error: searchResult.error
        })

        const relevantChunks = searchResult.results || []

        // Step 2: Build context from relevant documents
        let context = ''
        if (relevantChunks && relevantChunks.length > 0) {
            console.log('Found relevant chunks:', relevantChunks.length)
            
            // Group chunks by document for better context organization
            const documentGroups = (relevantChunks as DocumentChunk[]).reduce((groups: Record<string, DocumentChunk[]>, chunk: DocumentChunk) => {
                const title = chunk.document_title as string
                if (!groups[title]) groups[title] = []
                groups[title].push(chunk)
                return groups
            }, {} as Record<string, DocumentChunk[]>)

            // Build context with numbered documents for citation system
            const documentList: string[] = []
            context = Object.entries(documentGroups).map(([docTitle, chunks], index) => {
                const cleanTitle = docTitle.split(' - ')[0] || docTitle
                documentList.push(cleanTitle)
                const chunkContents = (chunks as DocumentChunk[]).map((chunk: DocumentChunk) => chunk.content as string).join('\n\n')
                
                // Add metadata information
                const firstChunk = chunks[0] as DocumentChunk
                const metadata = []
                if (firstChunk.document_jurisdiction) metadata.push(`Jurisdiction: ${firstChunk.document_jurisdiction}`)
                if (firstChunk.document_year) metadata.push(`Year: ${firstChunk.document_year}`)
                if (firstChunk.document_category) metadata.push(`Category: ${firstChunk.document_category}`)
                
                const metadataStr = metadata.length > 0 ? `\n(${metadata.join(', ')})` : ''
                
                return `[${index + 1}] ${cleanTitle}${metadataStr}\n\n${chunkContents}`
            }).join('\n\n---\n\n')

            // Store document list for reference generation
            ; (relevantChunks as DocumentChunksWithList).documentList = documentList

            console.log('Built context length:', context.length)
        } else {
            console.log('No relevant legislation documents found')
        }

        // Step 3: Build conversation history (last 4 messages for context)
        const conversationHistory = history.slice(-4)
        const historyText = conversationHistory.length > 0
            ? conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')
            : ''

        // Step 4: Create the system prompt with context
        const systemPrompt = `You are Actalyze AI, a specialized US legislation and legal document assistant. You provide accurate, well-researched information about federal and state laws, regulations, case law, and bills.

CORE RESPONSIBILITIES:
- Answer questions about US legislation, legal documents, regulations, and case law
- Provide accurate legal information based on the provided document context
- Help users understand complex legal language and concepts
- Always cite your sources using numbered references [1], [2], etc.

IMPORTANT GUIDELINES:
- Always base your responses on the provided legal documents when available
- If the user's question can be answered using the document context, reference the specific information naturally
- Use numbered citations [1], [2], etc. immediately after referenced information
- If no relevant context is provided, clearly state that you don't have specific documents to reference
- Keep responses clear, professional, and accessible
- When discussing legal matters, remind users that this is informational only and not legal advice

DISCLAIMER:
- Always remind users when appropriate that this is informational content, not legal advice
- For specific legal situations, recommend consulting with a qualified attorney

REFERENCING STYLE:
- Use numbered citations in square brackets [1], [2], etc. for all factual claims from documents
- Place citations immediately after the relevant information: "The statute requires... [1]."
- Use the same number for all references to the same document
- Write naturally without mentioning document names in the body text

CRITICAL INSTRUCTION - DO NOT ADD REFERENCES SECTION:
- NEVER add "References:", "Sources:", or similar sections at the end
- NEVER list the document titles in your response
- End your response with your final content sentence
- The references section will be automatically added for you
- Your job is ONLY to provide content with inline citations [1], [2], etc.

${context ? `RELEVANT LEGAL DOCUMENTS:\n${context}\n` : ''}

${historyText ? `CONVERSATION HISTORY:\n${historyText}\n` : ''}

Please provide a helpful, accurate response to the user's question, incorporating relevant information from the legal documents using numbered citations [1], [2], etc.`

        // Step 5: Generate AI response with streaming
        const stream = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: message
                }
            ],
            max_tokens: 1000,
            temperature: 0.7,
            stream: true
        })

        // Create a readable stream for the client
        const encoder = new TextEncoder()
        let fullResponse = ''

        const readableStream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of stream) {
                        const content = chunk.choices[0]?.delta?.content || ''
                        if (content) {
                            fullResponse += content
                            // Send chunk to client
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
                        }
                    }

                    // Add references section if we have documents
                    if (relevantChunks && relevantChunks.length > 0 && (relevantChunks as DocumentChunksWithList).documentList) {
                        const documentList = (relevantChunks as DocumentChunksWithList).documentList as string[]

                        // Check if AI already added a References section (case insensitive)
                        const hasReferencesSection = /references?\s*:/i.test(fullResponse)

                        if (!hasReferencesSection) {
                            const referencesSection = '\n\n**References:**\n' +
                                documentList.map((title, index) => `[${index + 1}] ${title}`).join('\n')
                            fullResponse += referencesSection

                            // Send references as a separate chunk
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: referencesSection })}\n\n`))
                        }
                    }

                    // Send final metadata with sources
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        done: true,
                        sourcesUsed: relevantChunks ? relevantChunks.length : 0,
                        sources: relevantChunks ?
                            Array.from(
                                (relevantChunks as DocumentChunk[]).reduce((map, chunk: DocumentChunk) => {
                                    const title = chunk.document_title as string
                                    const category = chunk.document_category
                                    const score = chunk.similarity as number

                                    if (!map.has(title) || (map.get(title)?.relevanceScore || 0) < score) {
                                        map.set(title, {
                                            title,
                                            category: category || 'General',
                                            relevanceScore: score
                                        })
                                    }
                                    return map
                                }, new Map<string, { title: string; category: string; relevanceScore: number }>()).values()
                            ) : []
                    })}\n\n`))

                    controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                    controller.close()

                } catch (error) {
                    console.error('Streaming error:', error)
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`))
                    controller.close()
                }
            }
        })

        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        })

    } catch (error) {
        console.error('Chatbot API error:', error)
        return NextResponse.json(
            { error: 'Failed to process chat message' },
            { status: 500 }
        )
    }
}
