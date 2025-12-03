"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  MapPin,
  Newspaper,
  Scale,
  ExternalLink,
  TrendingUp,
  FileText,
  Brain,
} from "lucide-react";
import Nav from "../../components/Nav";
import DistrictSearch from "../../components/DistrictSearch";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardHeader, CardContent } from "../../components/ui/Card";
import { fetchWithCache } from "@/src/lib/fetchWithCache";
import AIPollingGauge from "../../components/AIPollingGauge";
import TrendingTopicsPanel from "../../components/TrendingTopicsPanel";
import ElectionOutlook from "../../components/ElectionOutlook";
import KeyInsightsFeed from "../../components/KeyInsightsFeed";
import type { AIIntelResponse } from "@/lib/ai-intel";

// Dynamically import map to avoid SSR issues
const DistrictMap = dynamic(
  () => import("../../components/DistrictMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-900/40">
        <div className="text-sm text-zinc-600">Loading map...</div>
      </div>
    )
  }
);

// Dynamically import TweetEmbed to avoid SSR issues
const TweetEmbed = dynamic(
  () => import("../../components/TweetEmbed"),
  { ssr: false }
);

interface Headline {
  title: string;
  url: string;
  source: string;
  date?: string;
  thumbnail?: string;
}

interface PartyPerspectives {
  democrats: {
    summary: string;
    talkingPoints: string[];
  };
  republicans: {
    summary: string;
    talkingPoints: string[];
  };
}

interface Tweet {
  id: string;
  text: string;
  author: string;
  username: string;
  url: string;
}

export default function DistrictPage() {
  const params = useParams();
  const router = useRouter();
  const districtCode = (params.code as string)?.toUpperCase();

  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [pollingData, setPollingData] = useState<{ trend: string | null; description: string } | null>(null);
  const [perspectives, setPerspectives] = useState<PartyPerspectives | null>(null);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [aiIntel, setAiIntel] = useState<AIIntelResponse | null>(null);
  const [aiIntelLoading, setAiIntelLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!districtCode) return;

    // Fetch district data in parallel
    Promise.all([
      fetchWithCache(`/api/district/news?district=${districtCode}`).then(res => res.json()),
      fetchWithCache(`/api/district/summary?district=${districtCode}`).then(res => res.json()),
      fetchWithCache(`/api/district/polling?district=${districtCode}`).then(res => res.json()),
      fetchWithCache(`/api/topic/perspectives?topic=${districtCode} district`).then(res => res.json()),
      fetchWithCache(`/api/district/tweets?district=${districtCode}`).then(res => res.json()),
    ])
      .then(([newsData, summaryData, polling, perspectivesData, tweetsData]) => {
        setHeadlines(newsData.headlines || []);
        setSummary(summaryData.summary || "");
        setPollingData(polling);
        setPerspectives(perspectivesData);
        setTweets(tweetsData.tweets || []);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching district data:", error);
        setLoading(false);
      });

    // Fetch AI intel separately (it takes longer and is cached for 6 hours)
    fetchWithCache(`/api/district/ai-intel?district=${districtCode}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setAiIntel(data);
        }
        setAiIntelLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching AI intel:", error);
        setAiIntelLoading(false);
      });
  }, [districtCode]);

  const handleBack = () => {
    router.push("/");
  };

  const handleChat = () => {
    router.push(`/chatbot?topic=District ${districtCode}`);
  };

  if (!districtCode) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
        <div className="text-center">
          <p className="text-zinc-600 dark:text-zinc-300">Invalid district code</p>
        </div>
      </div>
    );
  }

  const districtLabel = districtCode.replace(/^([A-Z]{2})(\d{2})$/, '$1-$2');

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900 text-zinc-900 dark:text-zinc-100">
      <Nav onChatClick={handleChat} />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
      >
        {/* Header */}
        <div className="max-w-7xl mx-auto px-4 pt-8 pb-4">
          <div className="flex items-center gap-3 text-sm text-zinc-500 mb-3">
            <Button variant="ghost" onClick={handleBack}>
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
            <span>/</span>
            <span>District</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Congressional District {districtLabel}
            </h1>
            <Badge className="bg-purple-100 text-purple-900 dark:bg-purple-900 dark:text-purple-100">
              <MapPin className="w-3 h-3" />
              {districtLabel}
            </Badge>
          </div>
        </div>

        {/* Search Bar */}
        <div className="max-w-7xl mx-auto px-4 pb-6">
          <DistrictSearch />
        </div>

        {/* Map and News Grid */}
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-5 pb-8">
          {/* District Map */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                District Map
              </div>
              <Badge className="bg-purple-100 text-purple-900 dark:bg-purple-900 dark:text-purple-100">
                {districtLabel}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[400px] w-full">
                <DistrictMap districtCode={districtCode} />
              </div>
            </CardContent>
          </Card>

          {/* Local News Headlines */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <Newspaper className="w-4 h-4" />
                Local News
              </div>
              <Badge className="bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100">
                Headlines
              </Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  Loading news...
                </div>
              ) : headlines.length === 0 ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  No headlines available
                </div>
              ) : (
                <div className="space-y-4">
                  {headlines.map((headline, i) => (
                    <a
                      key={i}
                      href={headline.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <div className="flex gap-3">
                        {headline.thumbnail && (
                          <div className="flex-shrink-0">
                            <img
                              src={headline.thumbnail}
                              alt=""
                              className="w-16 h-16 rounded-lg object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2 mb-1">
                            {headline.title}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <span>{headline.source}</span>
                            {headline.date && (
                              <>
                                <span>•</span>
                                <span>{headline.date}</span>
                              </>
                            )}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Summary and Polling Grid */}
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-5 pb-8">
          {/* District Summary */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" />
                District News Summary
              </div>
              <Badge className="bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100">
                This Week
              </Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  Generating summary...
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {summary}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Polling */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Recent Polling
              </div>
              <Badge className="bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100">
                Trends
              </Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  Loading polling data...
                </div>
              ) : !pollingData || !pollingData.trend ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  Polling data unavailable
                </div>
              ) : (
                <div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                    {pollingData.trend}
                  </div>
                  <div className="text-sm text-zinc-700 dark:text-zinc-300">
                    {pollingData.description}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Political Intelligence Section */}
        <div className="max-w-7xl mx-auto px-4 pb-8">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              AI Political Intelligence
            </h2>
            <Badge className="bg-purple-100 text-purple-900 dark:bg-purple-900 dark:text-purple-100">
              Experimental
            </Badge>
          </div>

          {aiIntelLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="animate-pulse">
                  <Brain className="w-8 h-8 mx-auto mb-3 text-purple-400" />
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    Analyzing social media sentiment...
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">
                    This may take a moment
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : aiIntel ? (
            <div className="grid md:grid-cols-2 gap-5">
              {/* Left column: Polling and Election Outlook */}
              <div className="space-y-5">
                <AIPollingGauge
                  estimate={aiIntel.polling.estimate}
                  margin={aiIntel.polling.margin}
                  confidence={aiIntel.polling.confidence}
                  sampleSize={aiIntel.sample_size}
                  vsTraditional={aiIntel.polling.vs_traditional}
                />
                <ElectionOutlook
                  rating={aiIntel.election_outlook.rating}
                  confidence={aiIntel.election_outlook.confidence}
                  keyFactors={aiIntel.election_outlook.key_factors}
                />
              </div>

              {/* Right column: Topics and Insights */}
              <div className="space-y-5">
                <TrendingTopicsPanel topics={aiIntel.topics} />
                <KeyInsightsFeed insights={aiIntel.insights} />
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  AI intelligence unavailable for this district
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Political Context */}
        <div className="max-w-7xl mx-auto px-4 pb-16">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <Scale className="w-4 h-4" />
                Political Context
              </div>
              <Badge className="bg-purple-100 text-purple-900 dark:bg-purple-900 dark:text-purple-100">
                Party Perspectives
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {/* Democrats */}
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🫏</span>
                    <div className="font-semibold text-blue-900 dark:text-blue-100">
                      Democrats are saying
                    </div>
                  </div>
                  <div className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                    {perspectives?.democrats?.summary || "Loading perspective..."}
                  </div>
                  {perspectives?.democrats?.talkingPoints && perspectives.democrats.talkingPoints.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                        Key Talking Points
                      </div>
                      <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                        {perspectives.democrats.talkingPoints.map((point, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-blue-500 dark:text-blue-400 mt-0.5">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Republicans */}
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🐘</span>
                    <div className="font-semibold text-red-900 dark:text-red-100">
                      Republicans are saying
                    </div>
                  </div>
                  <div className="text-sm text-red-800 dark:text-red-200 mb-3">
                    {perspectives?.republicans?.summary || "Loading perspective..."}
                  </div>
                  {perspectives?.republicans?.talkingPoints && perspectives.republicans.talkingPoints.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">
                        Key Talking Points
                      </div>
                      <ul className="space-y-1 text-sm text-red-800 dark:text-red-200">
                        {perspectives.republicans.talkingPoints.map((point, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-red-500 dark:text-red-400 mt-0.5">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Tweets */}
        <div className="max-w-7xl mx-auto px-4 pb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Top Tweets
              </div>
              <Badge className="bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100">
                Social Media
              </Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  Loading tweets...
                </div>
              ) : tweets.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {tweets.map((tweet) => (
                    <div key={tweet.id}>
                      <TweetEmbed tweetId={tweet.id} username={tweet.username} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  No tweets found for this district
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Actions */}
        <div className="max-w-7xl mx-auto px-4 pb-16 flex items-center justify-between">
          <Button variant="outline" onClick={handleBack}>
            <ChevronLeft className="w-4 h-4" />
            Back to Home
          </Button>
        </div>
      </motion.div>

      <footer className="max-w-7xl mx-auto px-4 py-10 text-sm text-zinc-500">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>Actalyze © {new Date().getFullYear()}</div>
          <div>Trusted by congressional staffers and policy professionals</div>
          <div>AI-powered intelligence for modern governance</div>
        </div>
      </footer>
    </div>
  );
}
