"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import AppLayout from "../components/AppLayout";
import { CheckSquare, Upload, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface CheckResult {
  overallScore: number;
  overallGrade: string;
  categories: {
    name: string;
    score: number;
    status: "pass" | "warning" | "fail";
    findings: string[];
    recommendations: string[];
  }[];
  summary: string;
}

export default function StandardsCheckerPage() {
  const searchParams = useSearchParams();
  const fromMemo = searchParams.get("fromMemo") === "true";

  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState("general");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Load content from session storage if coming from Draft Memo
  useEffect(() => {
    if (fromMemo) {
      const savedMemo = sessionStorage.getItem("memoToCheck");
      const savedType = sessionStorage.getItem("memoType");
      if (savedMemo) {
        setContent(savedMemo);
        setContentType(savedType || "general");
        // Clear session storage
        sessionStorage.removeItem("memoToCheck");
        sessionStorage.removeItem("memoType");
      }
    }
  }, [fromMemo]);

  const handleCheck = async () => {
    if (!content.trim()) {
      setError("Please enter content to check");
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/standards-checker/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          contentType,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to check content");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError("Failed to check content. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: "pass" | "warning" | "fail") => {
    switch (status) {
      case "pass":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case "fail":
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "A":
      case "A+":
        return "text-green-600 dark:text-green-400";
      case "B":
      case "B+":
        return "text-blue-600 dark:text-blue-400";
      case "C":
      case "C+":
        return "text-yellow-600 dark:text-yellow-400";
      default:
        return "text-red-600 dark:text-red-400";
    }
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Communication Standards Checker
            </h1>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400">
            Evaluate your communications against House of Representatives standards and best practices
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Content Type */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Content Type
              </label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
              >
                <option value="general">General Communication</option>
                <option value="press-release">Press Release</option>
                <option value="newsletter">Newsletter</option>
                <option value="constituent-letter">Constituent Letter</option>
                <option value="floor-statement">Floor Statement</option>
                <option value="social-media">Social Media Post</option>
              </select>
            </div>

            {/* Content Input */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Content to Check
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your communication content here..."
                rows={16}
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-500 focus:border-transparent resize-none font-mono text-sm"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Check Button */}
            <button
              onClick={handleCheck}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <CheckSquare className="w-5 h-5" />
                  Check Standards Compliance
                </>
              )}
            </button>

            {/* Standards Reference */}
            <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                What We Check
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                <li>• Franking regulations compliance</li>
                <li>• Nonpartisan language requirements</li>
                <li>• Proper use of official resources</li>
                <li>• Constituent service focus</li>
                <li>• Accessibility and clarity</li>
                <li>• Format and structure best practices</li>
              </ul>
            </div>
          </div>

          {/* Results Section */}
          <div>
            <div className="sticky top-24">
              {isLoading ? (
                <div className="flex items-center justify-center h-96 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-zinc-400" />
                    <p className="text-zinc-500">Analyzing your content...</p>
                  </div>
                </div>
              ) : result ? (
                <div className="space-y-6">
                  {/* Overall Score */}
                  <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        Overall Assessment
                      </h2>
                      <div className={`text-4xl font-bold ${getGradeColor(result.overallGrade)}`}>
                        {result.overallGrade}
                      </div>
                    </div>
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-zinc-600 dark:text-zinc-400">Compliance Score</span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {result.overallScore}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            result.overallScore >= 80
                              ? "bg-green-500"
                              : result.overallScore >= 60
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${result.overallScore}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{result.summary}</p>
                  </div>

                  {/* Category Results */}
                  <div className="space-y-4">
                    {result.categories.map((category, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(category.status)}
                            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                              {category.name}
                            </h3>
                          </div>
                          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                            {category.score}%
                          </span>
                        </div>

                        {category.findings.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                              Findings
                            </p>
                            <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                              {category.findings.map((finding, i) => (
                                <li key={i}>• {finding}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {category.recommendations.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                              Recommendations
                            </p>
                            <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                              {category.recommendations.map((rec, i) => (
                                <li key={i}>• {rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-96 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800">
                  <div className="text-center text-zinc-400 dark:text-zinc-500">
                    <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Paste your content and click check to see results</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
