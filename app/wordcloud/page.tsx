/**
 * Word Cloud Analytics Page
 * Interactive visualization of trending words in political discourse
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Cloud, Download, TrendingUp, Info } from "lucide-react";
import AppLayout from "../components/AppLayout";
import WordCloudVisualization from "../components/WordCloudVisualization";
import WordCloudFiltersComponent from "../components/WordCloudFilters";
import { Button } from "../components/ui/Button";
import type { WordCloudData, WordCloudFilters } from "@/types/wordcloud";

function WordCloudPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [wordCloudData, setWordCloudData] = useState<WordCloudData | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<WordCloudFilters | null>(null);

  // Check if we should exclude the main keyword from the cloud
  const excludeKeyword = searchParams.get("excludeKeyword") === "true";

  // Load initial data from URL params if present
  useEffect(() => {
    const topicParam = searchParams.get("topic");
    if (topicParam) {
      const initialFilters: WordCloudFilters = {
        topic: topicParam,
        timeRange:
          (searchParams.get("timeRange") as WordCloudFilters["timeRange"]) ||
          "7d",
        location: searchParams.get("location") || "national",
        sentimentType:
          (searchParams.get(
            "sentimentType"
          ) as WordCloudFilters["sentimentType"]) || "all",
      };
      handleGenerateWordCloud(initialFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerateWordCloud = async (newFilters: WordCloudFilters) => {
    setLoading(true);
    setFilters(newFilters);

    try {
      // Update URL params
      const params = new URLSearchParams({
        topic: newFilters.topic,
        timeRange: newFilters.timeRange,
        location: newFilters.location || "national",
        sentimentType: newFilters.sentimentType || "all",
        maxTweets: "500", // Fetch 500 tweets
      });

      // Preserve excludeKeyword if set (from district page navigation)
      if (excludeKeyword) {
        params.set("excludeKeyword", "true");
      }

      router.push(`/wordcloud?${params.toString()}`, { scroll: false });

      // Fetch word cloud data
      const response = await fetch(
        `/api/wordcloud/generate?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to generate word cloud");
      }

      const data: WordCloudData = await response.json();
      setWordCloudData(data);
    } catch (error) {
      console.error("Error generating word cloud:", error);
      alert("Failed to generate word cloud. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setWordCloudData(null);
    setFilters(null);
    router.push("/wordcloud", { scroll: false });
  };

  const handleWordClick = (word: string) => {
    if (!filters) return;

    // Navigate to word analytics page
    const params = new URLSearchParams({
      word,
      topic: filters.topic,
      timeRange: filters.timeRange,
      location: filters.location || "national",
    });
    router.push(
      `/wordcloud/analytics/${encodeURIComponent(word)}?${params.toString()}`
    );
  };

  const handleExportCSV = () => {
    if (!wordCloudData) return;

    // Create CSV content
    const headers = ["Word", "Frequency", "Sentiment", "Category"];
    const rows = wordCloudData.words.map((word) => {
      const category =
        word.sentiment > 0.1
          ? "Positive"
          : word.sentiment < -0.1
          ? "Negative"
          : "Neutral";
      return [
        word.text,
        word.value.toString(),
        word.sentiment.toFixed(3),
        category,
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");

    // Download CSV
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wordcloud-${filters?.topic}-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout
      onChatClick={() => router.push("/chatbot")}
      onUploadClick={() => router.push("/upload")}
    >
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-xl shadow-blue-500/30 dark:shadow-purple-500/30">
              <Cloud className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                Word Cloud Analytics
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 text-lg">
                Visualize and analyze trending words in political discourse
              </p>
            </div>
          </div>

          {/* Info Banner */}
          <div className="mt-6 bg-gradient-to-br from-blue-50 via-purple-50/30 to-pink-50/20 dark:from-blue-950/30 dark:via-purple-950/20 dark:to-pink-950/10 border-2 border-blue-200 dark:border-blue-800/50 rounded-2xl p-5 shadow-lg">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-md">
                <Info className="w-5 h-5 text-white" />
              </div>
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <p className="font-bold mb-2 text-base text-blue-950 dark:text-blue-50">
                  How it works:
                </p>
                <p className="text-blue-800 dark:text-blue-200 leading-relaxed">
                  Enter a political topic to analyze the most frequently used
                  words in recent Twitter discussions. Word size reflects
                  frequency, color indicates sentiment (green = positive, red =
                  negative, blue = neutral). Click any word for detailed
                  analytics.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-[350px,1fr] gap-6">
          {/* Filters Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <WordCloudFiltersComponent
              onApply={handleGenerateWordCloud}
              onReset={handleReset}
              loading={loading}
              initialFilters={filters || undefined}
            />
          </motion.div>

          {/* Word Cloud Visualization */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-4"
          >
            {/* Stats Bar */}
            {wordCloudData && !loading && (
              <div className="bg-gradient-to-br from-white via-zinc-50/50 to-blue-50/30 dark:from-zinc-900 dark:via-zinc-900/80 dark:to-blue-950/20 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between flex-wrap gap-6">
                  <div className="flex items-center gap-8">
                    <div className="group">
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                        Topic
                      </p>
                      <p className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                        {wordCloudData.metadata.topic}
                      </p>
                    </div>
                    <div className="h-14 w-px bg-gradient-to-b from-transparent via-zinc-300 dark:via-zinc-700 to-transparent"></div>
                    <div className="group">
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                        Tweets Analyzed
                      </p>
                      <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-baseline gap-1">
                        {wordCloudData.metadata.totalTweets.toLocaleString()}
                        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                          tweets
                        </span>
                      </p>
                    </div>
                    <div className="h-14 w-px bg-gradient-to-b from-transparent via-zinc-300 dark:via-zinc-700 to-transparent"></div>
                    <div className="group">
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                        Unique Words
                      </p>
                      <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-baseline gap-1">
                        {wordCloudData.metadata.uniqueWords.toLocaleString()}
                        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                          words
                        </span>
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-green-500 dark:border-green-600 bg-white dark:bg-zinc-900 hover:bg-green-50 dark:hover:bg-green-950/30 text-green-700 dark:text-green-400 font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                </div>
              </div>
            )}

            {/* Word Cloud */}
            <div className="bg-gradient-to-br from-white via-zinc-50/30 to-zinc-100/20 dark:from-zinc-900 dark:via-zinc-900/50 dark:to-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-2xl">
              {!wordCloudData && !loading && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center mb-6 shadow-lg">
                    <TrendingUp className="w-12 h-12 text-zinc-400 dark:text-zinc-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">
                    Ready to analyze
                  </h3>
                  <p className="text-zinc-600 dark:text-zinc-400 max-w-md text-lg leading-relaxed">
                    Enter a political topic in the filters panel and click
                    &ldquo;Generate Word Cloud&rdquo; to begin
                  </p>
                </div>
              )}

              <WordCloudVisualization
                words={wordCloudData?.words || []}
                onWordClick={handleWordClick}
                loading={loading}
              />
            </div>

            {/* Updated timestamp */}
            {wordCloudData && !loading && (
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  Last updated:{" "}
                  {new Date(
                    wordCloudData.metadata.processedAt
                  ).toLocaleString()}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function WordCloudPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-600 dark:text-zinc-400">
              Loading Word Cloud...
            </p>
          </div>
        </div>
      }
    >
      <WordCloudPageContent />
    </Suspense>
  );
}
