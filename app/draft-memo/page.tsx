"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "../components/AppLayout";
import { FileText, Send, Copy, Download, Loader2 } from "lucide-react";

type MemoType = "press-release" | "newsletter" | "constituent-letter" | "floor-statement" | "social-media";

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

export default function DraftMemoPage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<MemoType>("press-release");
  const [district, setDistrict] = useState("");
  const [topic, setTopic] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [generatedMemo, setGeneratedMemo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedTemplate = MEMO_TEMPLATES.find((t) => t.type === selectedType)!;

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("Please enter a topic or description");
      return;
    }

    setIsLoading(true);
    setError("");
    setGeneratedMemo("");

    try {
      const response = await fetch("/api/draft-memo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          district: district || undefined,
          topic: topic.trim(),
          additionalContext: additionalContext.trim() || undefined,
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

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedMemo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedMemo], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedType}-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                )}
              </div>

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
