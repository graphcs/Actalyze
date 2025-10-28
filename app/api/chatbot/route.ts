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

// Helper function to extract financial data from AI response for charting
function extractFinancialData(response: string, query: string): { type: string; title: string; data: unknown[] } | null {
    try {
        // Pattern to match financial allocations like "Category: $X billion/million"
        const allocationPattern = /([A-Z][A-Za-z\s&,]+?):\s*\$?([\d,.]+)\s*(billion|million|trillion)/gi
        const matches = [...response.matchAll(allocationPattern)]

        if (matches.length < 2) {
            return null // Need at least 2 categories to make a meaningful chart
        }

        const allocations = matches.slice(0, 10).map(match => {
            const category = match[1].trim()
            const amount = parseFloat(match[2].replace(/,/g, ''))
            const unit = match[3].toLowerCase()

            let value = amount
            if (unit === 'trillion') value = amount * 1e12
            else if (unit === 'billion') value = amount * 1e9
            else if (unit === 'million') value = amount * 1e6

            return {
                category,
                amount: value,
                name: category,
                value: value
            }
        })

        // Determine chart type based on query
        const isComparison = /compare|comparison|versus|vs\.?/i.test(query)
        const isBreakdown = /breakdown|distribution|composition/i.test(query)

        // Extract title from query
        let title = 'Budget Overview'
        if (query.toLowerCase().includes('infrastructure')) {
            title = 'Infrastructure Investment and Jobs Act - Budget Breakdown'
        } else if (query.toLowerCase().includes('inflation reduction')) {
            title = 'Inflation Reduction Act - Funding Allocations'
        } else if (isComparison) {
            title = 'Federal Spending Comparison'
        }

        return {
            type: isBreakdown || allocations.length <= 8 ? 'pie' : 'bar',
            title,
            data: allocations
        }
    } catch (error) {
        console.error('Error extracting financial data:', error)
        return null
    }
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

        // Step 4: Detect if query is about bill financials/budget
        const isFinancialQuery = /\b(budget|funding|allocation|spending|cost|financial|money|billion|million|trillion|appropriation|expenditure)\b/i.test(message)

        // Step 5: Create the system prompt with context
        const systemPrompt = `You are Actalyze AI, a specialized assistant for US politics, legislation, and current events. You provide accurate, well-researched information about political topics, news, party positions, legislation, regulations, case law, and bills.

CORE RESPONSIBILITIES:
- Answer questions about US politics, current events, trending topics, and news
- Provide information on Democratic and Republican party positions on issues
- Explain legislation, legal documents, regulations, and case law
- Analyze political discourse, polling data, and public opinion
- Help users understand complex political and legal topics
- Be comprehensive, balanced, and informative in your responses

RESPONSE STRATEGY:
- When relevant legal documents are provided in the context below, prioritize using them as your primary source
- Use numbered citations [1], [2], etc. when referencing specific information from the provided documents
- If the provided documents don't fully answer the question, supplement with your general knowledge of politics, news, and current events
- If no relevant documents are provided, simply answer using your general knowledge
- Never apologize for lack of documents or explain that you don't have specific sources
- For political questions, provide balanced perspectives showing multiple viewpoints when appropriate

REFERENCING STYLE (when using provided documents):
- Use numbered citations in square brackets [1], [2], etc. for factual claims from the provided documents
- Place citations immediately after the relevant information: "The statute requires... [1]."
- Use the same number for all references to the same document
- Write naturally without mentioning document names in the body text

CRITICAL INSTRUCTION - DO NOT ADD REFERENCES SECTION:
- NEVER add "References:", "Sources:", or similar sections at the end
- NEVER list the document titles in your response
- End your response with your final content sentence
- The references section will be automatically added for you
- Your job is ONLY to provide content with inline citations [1], [2], etc. when using provided documents

${isFinancialQuery ? `
SPECIAL INSTRUCTION FOR FINANCIAL QUERIES:
- If this query is about bill budgets, funding allocations, or spending, structure your response to include specific dollar amounts
- Break down major categories with their amounts (e.g., "Transportation: $110 billion, Broadband: $65 billion")
- Use clear category names and precise numbers from the documents or your knowledge
- Format: "Category Name: $X billion/million" on separate lines when listing multiple allocations
` : ''}

${context ? `RELEVANT LEGAL DOCUMENTS:\n${context}\n` : ''}

${historyText ? `CONVERSATION HISTORY:\n${historyText}\n` : ''}

Please provide a helpful, accurate response to the user's question, incorporating relevant information from the legal documents using numbered citations [1], [2], etc.`

        // Step 6: Generate AI response with streaming
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

                    // Extract financial data for charts if this is a financial query
                    let chartData = null
                    if (isFinancialQuery) {
                        chartData = extractFinancialData(fullResponse, message)
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

                    // Send final metadata with sources and chart data
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
                            ) : [],
                        chart: chartData
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
