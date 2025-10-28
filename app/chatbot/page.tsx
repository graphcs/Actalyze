"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import Nav from "../components/Nav";
import { useRouter, useSearchParams } from "next/navigation";

// Dynamically import chart components to avoid SSR issues
const BudgetBreakdownChart = dynamic(
  () => import("@/app/components/BudgetBreakdownChart"),
  { ssr: false }
);
const AllocationBarChart = dynamic(
  () => import("@/app/components/AllocationBarChart"),
  { ssr: false }
);

interface ChartData {
  type: string;
  title: string;
  data: Array<{
    category?: string;
    amount?: number;
    name?: string;
    value?: number;
  }>;
  total?: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  chart?: ChartData;
  sources?: Array<{
    title: string;
    category: string;
    relevanceScore: number;
  }>;
}

function ChatbotContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: inputMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    // Add assistant message placeholder
    let assistantMessageAdded = false;

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          history: messages.slice(-4), // Send last 4 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let streamedContent = "";

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);

                  if (parsed.content) {
                    streamedContent += parsed.content;

                    // Add assistant message on first content chunk
                    if (!assistantMessageAdded) {
                      const assistantMessage: ChatMessage = {
                        role: "assistant",
                        content: streamedContent,
                        timestamp: new Date().toISOString(),
                      };
                      setMessages((prev) => [...prev, assistantMessage]);
                      assistantMessageAdded = true;
                      setIsLoading(false);
                    } else {
                      // Update existing message
                      setMessages((prev) => {
                        const newMessages = [...prev];
                        if (
                          newMessages.length > 0 &&
                          newMessages[newMessages.length - 1].role ===
                            "assistant"
                        ) {
                          newMessages[newMessages.length - 1] = {
                            ...newMessages[newMessages.length - 1],
                            content: streamedContent,
                          };
                        }
                        return newMessages;
                      });
                    }
                  }

                  if (parsed.done && (parsed.sources || parsed.chart)) {
                    // Update last message with sources and chart data
                    setMessages((prev) => {
                      const newMessages = [...prev];
                      if (
                        newMessages.length > 0 &&
                        newMessages[newMessages.length - 1].role === "assistant"
                      ) {
                        newMessages[newMessages.length - 1] = {
                          ...newMessages[newMessages.length - 1],
                          sources: parsed.sources,
                          chart: parsed.chart || undefined,
                        };
                      }
                      return newMessages;
                    });
                  }
                } catch (e) {
                  console.error("Error parsing SSE data:", e);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content:
          "Sorry, I encountered an error processing your request. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
      {/* Navigation */}
      <Nav onUploadClick={() => router.push("/upload")} />

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <h2 className="text-3xl font-bold text-slate-800 mb-4">
                Let&apos;s discuss
              </h2>
              <p className="text-slate-600 mb-8">
                {topic
                  ? `Explore different perspectives and insights on ${topic}`
                  : "Ask me anything about trending political topics, news, and current events."}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {topic ? (
                  <>
                    <button
                      onClick={() =>
                        setInputMessage(
                          `What are Democrats saying about ${topic}?`
                        )
                      }
                      className="p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
                    >
                      <div className="font-medium text-slate-800 mb-1">
                        🫏 Ask the Democrats
                      </div>
                      <div className="text-sm text-slate-600">
                        Democratic perspective on this topic
                      </div>
                    </button>
                    <button
                      onClick={() =>
                        setInputMessage(
                          `What are Republicans saying about ${topic}?`
                        )
                      }
                      className="p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
                    >
                      <div className="font-medium text-slate-800 mb-1">
                        🐘 Ask the Republicans
                      </div>
                      <div className="text-sm text-slate-600">
                        Republican perspective on this topic
                      </div>
                    </button>
                    <button
                      onClick={() =>
                        setInputMessage(
                          `Research ${topic} and give me a comprehensive overview`
                        )
                      }
                      className="p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
                    >
                      <div className="font-medium text-slate-800 mb-1">
                        🔍 Research the Issue
                      </div>
                      <div className="text-sm text-slate-600">
                        In-depth analysis and background
                      </div>
                    </button>
                    <button
                      onClick={() =>
                        setInputMessage(
                          `Run the numbers on ${topic} - show me data, statistics, and key metrics`
                        )
                      }
                      className="p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
                    >
                      <div className="font-medium text-slate-800 mb-1">
                        📊 Run the Numbers
                      </div>
                      <div className="text-sm text-slate-600">
                        Data and statistics analysis
                      </div>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        setInputMessage(
                          "What are the latest trending political topics?"
                        )
                      }
                      className="p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
                    >
                      <div className="font-medium text-slate-800 mb-1">
                        🔥 Trending Topics
                      </div>
                      <div className="text-sm text-slate-600">
                        Current hot topics in politics
                      </div>
                    </button>
                    <button
                      onClick={() =>
                        setInputMessage(
                          "Summarize today's major political news"
                        )
                      }
                      className="p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
                    >
                      <div className="font-medium text-slate-800 mb-1">
                        📰 News Summary
                      </div>
                      <div className="text-sm text-slate-600">
                        Today&apos;s major political headlines
                      </div>
                    </button>
                    <button
                      onClick={() =>
                        setInputMessage(
                          "What are Democrats and Republicans debating right now?"
                        )
                      }
                      className="p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
                    >
                      <div className="font-medium text-slate-800 mb-1">
                        ⚖️ Party Positions
                      </div>
                      <div className="text-sm text-slate-600">
                        Current partisan debates
                      </div>
                    </button>
                    <button
                      onClick={() =>
                        setInputMessage("Show me polling data on key issues")
                      }
                      className="p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
                    >
                      <div className="font-medium text-slate-800 mb-1">📊 Polling Data</div>
                      <div className="text-sm text-slate-600">
                        Public opinion on key issues
                      </div>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-3xl px-6 py-4 rounded-lg ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-slate-200 text-slate-800"
                }`}
              >
                <div className="prose prose-slate max-w-none">
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>

                {message.chart && message.role === "assistant" && (
                  <div className="mt-4">
                    {message.chart.type === "pie" ? (
                      <BudgetBreakdownChart
                        data={message.chart.data.map((item) => ({
                          name: item.name || item.category || "",
                          value: item.value || item.amount || 0,
                        }))}
                        title={message.chart.title}
                        total={
                          message.chart.total ||
                          message.chart.data.reduce(
                            (sum, item) => sum + (item.value || item.amount || 0),
                            0
                          )
                        }
                      />
                    ) : (
                      <AllocationBarChart
                        data={message.chart.data.map((item) => ({
                          category: item.category || item.name || "",
                          amount: item.amount || item.value || 0,
                        }))}
                        title={message.chart.title}
                      />
                    )}
                  </div>
                )}

                {message.sources && message.sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="text-xs font-semibold text-slate-500 mb-2">
                      SOURCES USED ({message.sources.length})
                    </div>
                    <div className="space-y-1">
                      {message.sources.map((source, idx) => (
                        <div key={idx} className="text-xs text-slate-600">
                          <span className="font-medium">{source.title}</span>
                          {source.category && (
                            <span className="text-slate-400">
                              {" "}
                              • {source.category}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-3xl px-6 py-4 rounded-lg bg-white border border-slate-200">
                <div className="flex items-center gap-2 text-slate-600">
                  <div
                    className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-slate-200 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask about US legislation, regulations, or legal documents..."
              className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-500 text-center">
            Actalyze: From Acts to Actions. Your AI Legislative Assistant.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatbotPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <ChatbotContent />
    </Suspense>
  );
}
