'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface ChatMessage {
    id?: string
    role: 'user' | 'assistant'
    content: string
    timestamp: string
    sources?: Array<{
        title: string
        category: string
        relevanceScore: number
    }>
}

interface Conversation {
    id: string
    title: string
    created_at: string
    updated_at: string
}

export default function ChatbotPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [inputMessage, setInputMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [conversationId, setConversationId] = useState<string | null>(null)
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [showSidebar, setShowSidebar] = useState(false)
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const router = useRouter()

    useEffect(() => {
        checkAuth()
        loadConversations()
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            router.push('/auth/login')
            return
        }
        setIsAuthenticated(true)
    }

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const loadConversations = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const response = await fetch('/api/chatbot', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            })

            if (response.ok) {
                const { conversations } = await response.json()
                setConversations(conversations || [])
            }
        } catch (error) {
            console.error('Error loading conversations:', error)
        }
    }

    const loadConversation = async (convId: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const response = await fetch(`/api/chatbot?conversationId=${convId}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            })

            if (response.ok) {
                const { messages: loadedMessages } = await response.json()
                const formattedMessages = loadedMessages.map((msg: Record<string, unknown>) => ({
                    role: msg.role as 'user' | 'assistant',
                    content: msg.content as string,
                    timestamp: msg.created_at as string
                }))
                setMessages(formattedMessages)
                setConversationId(convId)
                setShowSidebar(false)
            }
        } catch (error) {
            console.error('Error loading conversation:', error)
        }
    }

    const startNewConversation = () => {
        setMessages([])
        setConversationId(null)
        setShowSidebar(false)
    }

    const sendMessage = async () => {
        if (!inputMessage.trim() || isLoading) return

        const userMessage: ChatMessage = {
            role: 'user',
            content: inputMessage.trim(),
            timestamp: new Date().toISOString()
        }

        setMessages(prev => [...prev, userMessage])
        setInputMessage('')
        setIsLoading(true)

        // We'll add the assistant message only when we start receiving content
        const assistantMessageId = Date.now().toString()
        let assistantMessageAdded = false

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/auth/login')
                return
            }

            const response = await fetch('/api/chatbot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    message: userMessage.content,
                    conversationId: conversationId,
                    history: messages.slice(-4) // Send last 4 messages for context
                })
            })

            if (!response.ok) {
                throw new Error('Failed to get response')
            }

            // Handle streaming response
            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let streamedContent = ''

            if (reader) {
                try {
                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break

                        const chunk = decoder.decode(value)
                        const lines = chunk.split('\n')

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const data = line.slice(6)
                                if (data === '[DONE]') continue
                                
                                try {
                                    const parsed = JSON.parse(data)
                                    
                                    if (parsed.content) {
                                        streamedContent += parsed.content
                                        
                                        // Add assistant message on first content chunk
                                        if (!assistantMessageAdded) {
                                            const assistantMessage: ChatMessage = {
                                                id: assistantMessageId,
                                                role: 'assistant',
                                                content: streamedContent,
                                                timestamp: new Date().toISOString()
                                            }
                                            setMessages(prev => [...prev, assistantMessage])
                                            assistantMessageAdded = true
                                            setIsLoading(false) // Hide "thinking" indicator
                                        } else {
                                            // Update existing message
                                            setMessages(prev => prev.map(msg => 
                                                msg.id === assistantMessageId 
                                                    ? { ...msg, content: streamedContent }
                                                    : msg
                                            ))
                                        }
                                    }
                                    
                                    if (parsed.done) {
                                        // Handle final metadata
                                        if (parsed.conversationId && parsed.conversationId !== conversationId) {
                                            setConversationId(parsed.conversationId)
                                            loadConversations()
                                        }
                                        
                                        // Add sources to the final message
                                        setMessages(prev => prev.map(msg => 
                                            msg.id === assistantMessageId 
                                                ? { ...msg, sources: parsed.sources }
                                                : msg
                                        ))
                                    }
                                } catch (e) {
                                    // Ignore JSON parse errors for malformed chunks
                                }
                            }
                        }
                    }
                } finally {
                    reader.releaseLock()
                }
            }
        } catch (error) {
            console.error('Error sending message:', error)
            // Add error message if assistant message wasn't added yet
            if (!assistantMessageAdded) {
                const errorMessage: ChatMessage = {
                    id: assistantMessageId,
                    role: 'assistant',
                    content: 'Sorry, I encountered an error. Please try again.',
                    timestamp: new Date().toISOString()
                }
                setMessages(prev => [...prev, errorMessage])
            } else {
                // Update existing message with error
                setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                        ? { ...msg, content: 'Sorry, I encountered an error. Please try again.' }
                        : msg
                ))
            }
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    if (isAuthenticated === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => setShowSidebar(!showSidebar)}
                                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                            >
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>
                            <Link href="/" className="text-2xl font-bold text-amber-600" style={{ fontFamily: 'YoungSerif' }}>
                                GutRoot
                            </Link>
                            <span className="text-lg font-medium text-gray-700">AI Assistant</span>
                        </div>
                        <button
                            onClick={startNewConversation}
                            className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
                        >
                            New Chat
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex h-[calc(100vh-80px)]">
                {/* Sidebar */}
                <div className={`${showSidebar ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
                    <div className="flex flex-col h-full">
                        <div className="flex-1 overflow-y-auto p-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Chat History</h3>
                            <div className="space-y-2">
                                {conversations.map((conv) => (
                                    <button
                                        key={conv.id}
                                        onClick={() => loadConversation(conv.id)}
                                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                                            conversationId === conv.id 
                                                ? 'bg-amber-100 text-amber-800' 
                                                : 'hover:bg-gray-100 text-gray-700'
                                        }`}
                                    >
                                        <div className="font-medium truncate">{conv.title}</div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {new Date(conv.updated_at).toLocaleDateString()}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Overlay for mobile */}
                {showSidebar && (
                    <div 
                        className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                        onClick={() => setShowSidebar(false)}
                    />
                )}

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col lg:ml-0">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="max-w-4xl mx-auto space-y-6">
                            {messages.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="mb-8">
                                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to GutRoot AI</h2>
                                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                                            I'm your personal gut health assistant, powered by the latest scientific research. 
                                            Ask me anything about nutrition, digestive health, probiotics, and more!
                                        </p>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                                        <button
                                            onClick={() => setInputMessage("What foods are best for gut health?")}
                                            className="p-4 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow text-left"
                                        >
                                            <div className="font-medium text-gray-900">Best Foods for Gut Health</div>
                                            <div className="text-sm text-gray-500 mt-1">Learn about gut-friendly foods</div>
                                        </button>
                                        <button
                                            onClick={() => setInputMessage("How do probiotics work?")}
                                            className="p-4 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow text-left"
                                        >
                                            <div className="font-medium text-gray-900">Understanding Probiotics</div>
                                            <div className="text-sm text-gray-500 mt-1">Explore probiotic benefits</div>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                messages.map((message, index) => (
                                    <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-3xl ${message.role === 'user' ? 'bg-amber-600 text-white' : 'bg-white text-gray-900'} rounded-lg px-4 py-3 shadow-sm`}>
                                            <div className="whitespace-pre-wrap">{message.content}</div>
                                            {message.sources && message.sources.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-gray-200">
                                                    <div className="text-xs text-gray-500 mb-2">Sources referenced:</div>
                                                    <div className="space-y-1">
                                                        {message.sources.map((source, idx) => (
                                                            <div key={idx} className="text-xs bg-gray-50 rounded px-2 py-1">
                                                                <span className="font-medium">{source.title}</span>
                                                                <span className="text-gray-400 ml-2">({source.category})</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="text-xs opacity-70 mt-2">
                                                {new Date(message.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white rounded-lg px-4 py-3 shadow-sm">
                                        <div className="flex items-center space-x-2">
                                            <div className="flex space-x-1">
                                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                            </div>
                                            <span className="text-gray-500 text-sm">GutRoot AI is thinking...</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="border-t bg-white p-4">
                        <div className="max-w-4xl mx-auto">
                            <div className="flex space-x-4">
                                <div className="flex-1">
                                    <textarea
                                        value={inputMessage}
                                        onChange={(e) => setInputMessage(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        placeholder="Ask me about gut health, nutrition, or digestive wellness..."
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                                        rows={3}
                                        disabled={isLoading}
                                    />
                                </div>
                                <button
                                    onClick={sendMessage}
                                    disabled={!inputMessage.trim() || isLoading}
                                    className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors self-end"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                </button>
                            </div>
                            <div className="text-xs text-gray-500 mt-2">
                                Press Enter to send, Shift+Enter for new line
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
