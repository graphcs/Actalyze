/**
 * Word Analytics Detail Page
 * Grafana-like dashboard for individual word analysis
 */

"use client";

import { useState, useEffect, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  TrendingUp,
  MessageSquare,
  Heart,
  BarChart3,
  Clock,
  Users,
  Link2,
} from "lucide-react";
import Nav from "@/app/components/Nav";
import { Button } from "@/app/components/ui/Button";
import type { WordAnalytics } from "@/types/wordcloud";
import { Skeleton } from "@/app/components/ui/Skeleton";

interface WordAnalyticsPageProps {
  params: Promise<{
    word: string;
  }>;
}

export default function WordAnalyticsPage({ params }: WordAnalyticsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { word: encodedWord } = use(params);
  const word = decodeURIComponent(encodedWord);

  const [analytics, setAnalytics] = useState<WordAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const topic = searchParams.get("topic") || "";
  const timeRange = searchParams.get("timeRange") || "7d";
  const location = searchParams.get("location") || "national";

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!word || !topic) {
        setError("Missing required parameters");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          word,
          topic,
          timeRange,
          location,
          maxTweets: "100",
        });

        const response = await fetch(
          `/api/wordcloud/analytics?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch analytics");
        }

        const data: WordAnalytics = await response.json();
        setAnalytics(data);
      } catch (err) {
        console.error("Error fetching analytics:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load analytics"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [word, topic, timeRange, location]);

  const getSentimentColor = (score: number) => {
    if (score > 0.1)
      return "from-green-500 to-emerald-600 dark:from-green-400 dark:to-emerald-500";
    if (score < -0.1)
      return "from-red-500 to-rose-600 dark:from-red-400 dark:to-rose-500";
    return "from-blue-500 to-indigo-600 dark:from-blue-400 dark:to-indigo-500";
  };

  const formatSentimentScore = (score: number): string => {
    return (score * 100).toFixed(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
      <Nav
        onChatClick={() => router.push("/chatbot")}
        onUploadClick={() => router.push("/upload")}
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="mb-6 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Word Cloud
          </Button>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 flex items-center justify-center shadow-xl shadow-purple-500/30 dark:shadow-pink-500/30">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
                &ldquo;{word}&rdquo;
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 text-lg">
                Word Analytics for{" "}
                <span className="font-semibold">{topic}</span>
              </p>
            </div>
          </div>
        </motion.div>

        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-96 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
            <p className="text-red-900 dark:text-red-100 font-semibold mb-2">
              Error loading analytics
            </p>
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {analytics && !loading && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              {/* Total Occurrences */}
              <div className="bg-gradient-to-br from-white via-blue-50/30 to-blue-100/20 dark:from-zinc-900 dark:via-blue-950/20 dark:to-blue-950/10 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Total Uses
                </p>
                <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                  {analytics.totalOccurrences.toLocaleString()}
                </p>
              </div>

              {/* Average Sentiment */}
              <div className="bg-gradient-to-br from-white via-purple-50/30 to-purple-100/20 dark:from-zinc-900 dark:via-purple-950/20 dark:to-purple-950/10 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getSentimentColor(
                      analytics.sentiment.average
                    )} flex items-center justify-center`}
                  >
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Avg Sentiment
                </p>
                <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                  {formatSentimentScore(analytics.sentiment.average)}%
                </p>
              </div>

              {/* Total Tweets */}
              <div className="bg-gradient-to-br from-white via-green-50/30 to-green-100/20 dark:from-zinc-900 dark:via-green-950/20 dark:to-green-950/10 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Tweets
                </p>
                <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                  {analytics.topTweets.length}
                </p>
              </div>

              {/* Related Words */}
              <div className="bg-gradient-to-br from-white via-pink-50/30 to-pink-100/20 dark:from-zinc-900 dark:via-pink-950/20 dark:to-pink-950/10 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Related Words
                </p>
                <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                  {analytics.relatedWords.length}
                </p>
              </div>
            </motion.div>

            {/* Sentiment Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-gradient-to-br from-white via-zinc-50/50 to-zinc-100/20 dark:from-zinc-900 dark:via-zinc-900/80 dark:to-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Sentiment Distribution
                </h2>
              </div>

              <div className="space-y-4">
                {/* Positive */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      Positive
                    </span>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                      {analytics.sentiment.distribution.positive}
                    </span>
                  </div>
                  <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          (analytics.sentiment.distribution.positive /
                            analytics.topTweets.length) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Neutral */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      Neutral
                    </span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {analytics.sentiment.distribution.neutral}
                    </span>
                  </div>
                  <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          (analytics.sentiment.distribution.neutral /
                            analytics.topTweets.length) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Negative */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      Negative
                    </span>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">
                      {analytics.sentiment.distribution.negative}
                    </span>
                  </div>
                  <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 to-rose-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          (analytics.sentiment.distribution.negative /
                            analytics.topTweets.length) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Time Series */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="bg-gradient-to-br from-white via-zinc-50/50 to-zinc-100/20 dark:from-zinc-900 dark:via-zinc-900/80 dark:to-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    Usage Over Time
                  </h2>
                </div>

                {analytics.timeSeriesData.length > 0 ? (
                  <div className="space-y-2">
                    {analytics.timeSeriesData.slice(0, 10).map((point, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 w-32">
                          {new Date(point.timestamp).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                          })}
                        </span>
                        <div className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                            style={{
                              width: `${
                                (point.count /
                                  Math.max(
                                    ...analytics.timeSeriesData.map(
                                      (p) => p.count
                                    )
                                  )) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 w-8 text-right">
                          {point.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                    No time series data available
                  </p>
                )}
              </motion.div>

              {/* Related Words */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-gradient-to-br from-white via-zinc-50/50 to-zinc-100/20 dark:from-zinc-900 dark:via-zinc-900/80 dark:to-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    Frequently Co-occurring Words
                  </h2>
                </div>

                {analytics.relatedWords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {analytics.relatedWords.slice(0, 20).map((related, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-1.5 bg-gradient-to-r from-green-100 to-teal-100 dark:from-green-900/30 dark:to-teal-900/30 border border-green-300 dark:border-green-700 rounded-lg text-sm font-medium text-green-900 dark:text-green-100"
                      >
                        {related.word}
                        <span className="ml-2 text-xs text-green-700 dark:text-green-400">
                          ({related.coOccurrence})
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                    No related words found
                  </p>
                )}
              </motion.div>
            </div>

            {/* Top Tweets */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="bg-gradient-to-br from-white via-zinc-50/50 to-zinc-100/20 dark:from-zinc-900 dark:via-zinc-900/80 dark:to-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Top Tweets
                </h2>
              </div>

              {analytics.topTweets.length > 0 ? (
                <div className="space-y-4">
                  {analytics.topTweets.map((tweet, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 hover:shadow-lg transition-all duration-200"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">
                              @{tweet.username}
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {new Date(tweet.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-zinc-700 dark:text-zinc-300 mb-3">
                            {tweet.text}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                              <Heart className="w-4 h-4" />
                              {tweet.engagement}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                tweet.sentiment > 0.1
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                  : tweet.sentiment < -0.1
                                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                                  : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                              }`}
                            >
                              {tweet.sentiment > 0.1
                                ? "Positive"
                                : tweet.sentiment < -0.1
                                ? "Negative"
                                : "Neutral"}
                            </span>
                            <a
                              href={tweet.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              <Link2 className="w-4 h-4" />
                              View
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                  No tweets available
                </p>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
