/**
 * Word Cloud Analytics Page
 * Interactive visualization of trending words in political discourse
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Cloud, Download, TrendingUp, MessageSquare, Heart, Repeat2, ExternalLink } from "lucide-react";
import AppLayout from "../components/AppLayout";
import WordCloudVisualization from "../components/WordCloudVisualization";
import WordCloudFiltersComponent from "../components/WordCloudFilters";
import { Button } from "../components/ui/Button";
import type { WordCloudData, WordCloudFilters } from "@/types/wordcloud";

interface TopTweet {
  id: string;
  text: string;
  author: string;
  username: string;
  engagement: number;
  created_at: string;
}

interface WordCloudResponse extends WordCloudData {
  topTweets?: TopTweet[];
}

const STATE_NAMES: Record<string, string> = {
  "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
  "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
  "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
  "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
  "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
  "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
  "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
  "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
  "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
  "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
  "DC": "Washington D.C."
};

function getLocationLabel(location: string): string {
  if (!location || location === "national") return "National";
  return STATE_NAMES[location.toUpperCase()] || location;
}

function WordCloudPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [wordCloudData, setWordCloudData] = useState<WordCloudData | null>(
    null
  );
  const [topTweets, setTopTweets] = useState<TopTweet[]>([]);
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

      const data: WordCloudResponse = await response.json();
      setWordCloudData(data);
      setTopTweets(data.topTweets || []);
    } catch (error) {
      console.error("Error generating word cloud:", error);
      alert("Failed to generate word cloud. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setWordCloudData(null);
    setTopTweets([]);
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
            <div className="w-14 h-14 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center">
              <Cloud className="w-7 h-7 text-white dark:text-zinc-900" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                Word Cloud Analytics
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400">
                Visualize trending words in political discourse
              </p>
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
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
                <div className="flex items-center justify-between flex-wrap gap-6">
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                        Topic
                      </p>
                      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {wordCloudData.metadata.topic}
                      </p>
                    </div>
                    <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-700"></div>
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                        Location
                      </p>
                      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {getLocationLabel(filters?.location || "national")}
                      </p>
                    </div>
                    <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-700"></div>
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                        Tweets Analyzed
                      </p>
                      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {wordCloudData.metadata.totalTweets.toLocaleString()}
                      </p>
                    </div>
                    <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-700"></div>
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                        Unique Words
                      </p>
                      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {wordCloudData.metadata.uniqueWords.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                </div>
              </div>
            )}

            {/* Word Cloud */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
              {!wordCloudData && !loading && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                    <TrendingUp className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    Ready to analyze
                  </h3>
                  <p className="text-zinc-600 dark:text-zinc-400 max-w-md">
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

            {/* Top Tweets Section */}
            {wordCloudData && !loading && topTweets.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Top Tweets
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {topTweets.map((tweet) => (
                    <a
                      key={tweet.id}
                      href={`https://twitter.com/i/status/${tweet.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {new Date(tweet.created_at).toLocaleDateString()}
                        </span>
                        <ExternalLink className="w-3 h-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-snug mb-2 line-clamp-3">
                        {tweet.text}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                        <div className="flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5" />
                          <span>{tweet.engagement}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </motion.div>
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
        <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-900 dark:border-t-zinc-100 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-600 dark:text-zinc-400">
              Loading...
            </p>
          </div>
        </div>
      }
    >
      <WordCloudPageContent />
    </Suspense>
  );
}
