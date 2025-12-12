"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "../components/AppLayout";
import { FileText, Send, Loader2, User, ChevronDown, ChevronUp, Share2 } from "lucide-react";
import ShareToolbar from "../components/ShareToolbar";

type MemoType = "press-release" | "newsletter" | "constituent-letter" | "floor-statement" | "social-media";
type Perspective = "democrat" | "republican" | "neutral" | "";

interface MemoTemplate {
  type: MemoType;
  label: string;
  description: string;
  placeholder: string;
}

const MEMO_TEMPLATES: MemoTemplate[] = [
  {
    type: "press-release",
    label: "Press Release",
    description: "Official announcement for media distribution",
    placeholder: "Describe the announcement or news you want to communicate...",
  },
  {
    type: "newsletter",
    label: "Newsletter",
    description: "Regular update to constituents",
    placeholder: "What topics or updates do you want to include in this newsletter...",
  },
  {
    type: "constituent-letter",
    label: "Constituent Letter",
    description: "Direct response to constituent concerns",
    placeholder: "Describe the constituent's concern and the response you want to convey...",
  },
  {
    type: "floor-statement",
    label: "Floor Statement",
    description: "Remarks for the House floor",
    placeholder: "Describe the topic and key points for your floor statement...",
  },
  {
    type: "social-media",
    label: "Social Media Post",
    description: "Twitter/X or Facebook post",
    placeholder: "Describe what you want to communicate on social media...",
  },
];

// Local storage key for house member context
const HOUSE_MEMBER_CONTEXT_KEY = "actalyze_house_member_context";

function DraftMemoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedType, setSelectedType] = useState<MemoType>("press-release");
  const [district, setDistrict] = useState("");
  const [topic, setTopic] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [perspective, setPerspective] = useState<Perspective>("");
  const [generatedMemo, setGeneratedMemo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showShareToolbar, setShowShareToolbar] = useState(false);

  // House member context
  const [houseMemberContext, setHouseMemberContext] = useState("");
  const [useHouseMemberContext, setUseHouseMemberContext] = useState(false);
  const [showContextSettings, setShowContextSettings] = useState(false);
  const [contextSaved, setContextSaved] = useState(false);

  const selectedTemplate = MEMO_TEMPLATES.find((t) => t.type === selectedType)!;

  // Load house member context from localStorage and URL params
  useEffect(() => {
    // Load house member context
    const savedContext = localStorage.getItem(HOUSE_MEMBER_CONTEXT_KEY);
    if (savedContext) {
      setHouseMemberContext(savedContext);
    }

    // Pre-populate from URL params
    const urlTopic = searchParams.get("topic");
    const urlDescription = searchParams.get("description");

    if (urlTopic) {
      setTopic(urlTopic);
    }
    if (urlDescription) {
      setAdditionalContext(urlDescription);
    }
  }, [searchParams]);

  // Save house member context to localStorage
  const saveHouseMemberContext = () => {
    localStorage.setItem(HOUSE_MEMBER_CONTEXT_KEY, houseMemberContext);
    setContextSaved(true);
    setTimeout(() => setContextSaved(false), 2000);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("Please enter a topic or description");
      return;
    }

    setIsLoading(true);
    setError("");
    setGeneratedMemo("");

    // Build context including house member info if enabled
    let fullContext = additionalContext.trim();
    if (useHouseMemberContext && houseMemberContext.trim()) {
      fullContext = `House Member Context:\n${houseMemberContext.trim()}\n\n${fullContext}`;
    }

    try {
      const response = await fetch("/api/draft-memo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          district: district || undefined,
          topic: topic.trim(),
          additionalContext: fullContext || undefined,
          perspective: perspective || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate memo");
      }

      const data = await response.json();
      setGeneratedMemo(data.memo);
    } catch (err) {
      setError("Failed to generate memo. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckStandards = () => {
    if (generatedMemo) {
      // Store memo in session storage for the standards checker
      sessionStorage.setItem("memoToCheck", generatedMemo);
      sessionStorage.setItem("memoType", selectedType);
      router.push("/standards-checker?fromMemo=true");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Draft Communication Memo
            </h1>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400">
            Generate professional congressional communications following House standards
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Memo Type Selection */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                Communication Type
              </label>
              <div className="grid grid-cols-1 gap-2">
                {MEMO_TEMPLATES.map((template) => (
                  <button
                    key={template.type}
                    onClick={() => setSelectedType(template.type)}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      selectedType === template.type
                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800"
                        : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
                    }`}
                  >
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {template.label}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                      {template.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* District (Optional) */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Congressional District (Optional)
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g., CA-12, NY-14, TX-07"
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
              />
            </div>

            {/* Topic/Description */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Topic / Description *
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={selectedTemplate.placeholder}
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Additional Context */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Additional Context (Optional)
              </label>
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="Any specific talking points, data, or tone preferences..."
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Perspective Selection */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Drafting Perspective (Optional)
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPerspective("")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    perspective === ""
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  Default
                </button>
                <button
                  type="button"
                  onClick={() => setPerspective("democrat")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    perspective === "democrat"
                      ? "bg-blue-600 text-white"
                      : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                  }`}
                >
                  Democrat
                </button>
                <button
                  type="button"
                  onClick={() => setPerspective("republican")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    perspective === "republican"
                      ? "bg-red-600 text-white"
                      : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
                  }`}
                >
                  Republican
                </button>
                <button
                  type="button"
                  onClick={() => setPerspective("neutral")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    perspective === "neutral"
                      ? "bg-purple-600 text-white"
                      : "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                  }`}
                >
                  Neutral/Bipartisan
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {perspective === "democrat" && "Will use Democratic messaging and progressive framing."}
                {perspective === "republican" && "Will use Republican messaging and conservative framing."}
                {perspective === "neutral" && "Will use strictly bipartisan, non-partisan language."}
                {perspective === "" && "Will generate without specific partisan framing."}
              </p>
            </div>

            {/* House Member Context Section */}
            <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowContextSettings(!showContextSettings)}
                className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    House Member Context
                  </span>
                  {houseMemberContext && (
                    <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                      Saved
                    </span>
                  )}
                </div>
                {showContextSettings ? (
                  <ChevronUp className="w-4 h-4 text-zinc-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                )}
              </button>

              {showContextSettings && (
                <div className="p-4 space-y-3 border-t border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Add information about the House member (name, district, priorities, voting record, etc.) to personalize generated memos.
                  </p>
                  <textarea
                    value={houseMemberContext}
                    onChange={(e) => setHouseMemberContext(e.target.value)}
                    placeholder="e.g., Representative Jane Smith, CA-12. Priorities: climate action, affordable housing, healthcare access. Known for bipartisan work on infrastructure..."
                    rows={4}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-500 focus:border-transparent resize-none"
                  />
                  <button
                    type="button"
                    onClick={saveHouseMemberContext}
                    className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg transition-colors"
                  >
                    {contextSaved ? "Saved!" : "Save Context"}
                  </button>
                </div>
              )}
            </div>

            {/* Use House Member Context Checkbox */}
            {houseMemberContext && (
              <label className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={useHouseMemberContext}
                  onChange={(e) => setUseHouseMemberContext(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 focus:ring-zinc-500"
                />
                <div>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Use House Member Context
                  </span>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Include saved member information when generating the memo
                  </p>
                </div>
              </label>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Generate {selectedTemplate.label}
                </>
              )}
            </button>
          </div>

          {/* Output Section */}
          <div>
            <div className="sticky top-24">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Generated Communication
                </label>
                {generatedMemo && (
                  <button
                    onClick={() => setShowShareToolbar(!showShareToolbar)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Share & Export
                  </button>
                )}
              </div>

              {/* Share Toolbar */}
              {generatedMemo && showShareToolbar && (
                <div className="mb-3">
                  <ShareToolbar
                    content={generatedMemo}
                    title={`${selectedTemplate.label} - ${topic.slice(0, 50)}`}
                    onClose={() => setShowShareToolbar(false)}
                  />
                </div>
              )}

              <div className="min-h-[400px] p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full text-zinc-500">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    Generating your communication...
                  </div>
                ) : generatedMemo ? (
                  <div className="prose prose-zinc dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-800 dark:text-zinc-200">
                      {generatedMemo}
                    </pre>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-400 dark:text-zinc-500">
                    Your generated communication will appear here
                  </div>
                )}
              </div>

              {generatedMemo && (
                <button
                  onClick={handleCheckStandards}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Check Against House Standards
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function DraftMemoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      }
    >
      <DraftMemoContent />
    </Suspense>
  );
}
