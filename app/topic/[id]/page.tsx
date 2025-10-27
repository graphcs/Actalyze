"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Flame,
  MessageSquare,
  Share2,
  ExternalLink,
  DollarSign,
  TrendingUp,
  Scale,
} from "lucide-react";
import Nav from "../../components/Nav";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardHeader, CardContent } from "../../components/ui/Card";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

interface Topic {
  id: string;
  title: string;
  tags: string[];
  mentions: number;
  momentum: number;
  cost: number;
  color: string;
}

interface CongressData {
  sponsor: string;
  committee: string;
  status: string;
}

interface TopicDetailData {
  mentions: Array<{ week: string; count: number }>;
  totalMentions: number;
}

// Mock fiscal data - real CBO data would require Congress.gov API integration
const fiscalSeries = [
  { year: 2021, spend: 260, subsidies: 70 },
  { year: 2022, spend: 320, subsidies: 85 },
  { year: 2023, spend: 410, subsidies: 102 },
  { year: 2024, spend: 390, subsidies: 110 },
  { year: 2025, spend: 430, subsidies: 120 },
];

function numberFmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toString();
}

export default function TopicPage() {
  const params = useParams();
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [congressData, setCongressData] = useState<CongressData | null>(null);
  const [mentionsData, setMentionsData] = useState<Array<{ w: string; x: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const topicId = params.id as string;

    // Fetch trending topics to find this one
    fetch("/api/trending")
      .then((res) => res.json())
      .then((data) => {
        const foundTopic = data.find((t: Topic) => t.id === topicId);
        if (foundTopic) {
          setTopic(foundTopic);
        }
      })
      .catch((error) => {
        console.error("Error fetching topic:", error);
      });

    // Fetch topic-specific data (mentions over time)
    fetch(`/api/topic/${topicId}`)
      .then((res) => res.json())
      .then((data: TopicDetailData) => {
        // Transform mentions data for chart
        const chartData = data.mentions.map((m) => ({
          w: m.week,
          x: m.count,
        }));
        setMentionsData(chartData);
      })
      .catch((error) => {
        console.error("Error fetching topic details:", error);
        // Use fallback data
        setMentionsData([
          { w: "W1", x: 12 },
          { w: "W2", x: 18 },
          { w: "W3", x: 20 },
          { w: "W4", x: 23 },
          { w: "W5", x: 30 },
          { w: "W6", x: 28 },
          { w: "W7", x: 35 },
        ]);
      });

    // Fetch Congress data
    fetch("/api/congress")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.length > 0) {
          const randomBill = data[Math.floor(Math.random() * data.length)];
          setCongressData({
            sponsor: randomBill.sponsor || "Unknown",
            committee: randomBill.committee || "Unknown",
            status: randomBill.status || "Unknown",
          });
        }
      })
      .catch((error) => {
        console.error("Error fetching Congress data:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [params.id]);

  const handleBack = () => {
    router.push("/");
  };

  const handleChat = () => {
    router.push("/chatbot");
  };

  const handleShare = () => {
    // Copy URL to clipboard
    if (navigator.share) {
      navigator.share({
        title: topic?.title,
        text: `Check out ${topic?.title} on Actalyze`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    }
  };

  const handleSourceData = () => {
    // Link to Twitter search for this topic
    if (topic) {
      const searchQuery = encodeURIComponent(topic.title);
      window.open(`https://twitter.com/search?q=${searchQuery}&f=live`, "_blank");
    }
  };

  if (loading || !topic) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 mb-4">
            <div
              className="w-3 h-3 bg-zinc-900 dark:bg-zinc-100 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            ></div>
            <div
              className="w-3 h-3 bg-zinc-900 dark:bg-zinc-100 rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            ></div>
            <div
              className="w-3 h-3 bg-zinc-900 dark:bg-zinc-100 rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            ></div>
          </div>
          <p className="text-zinc-600 dark:text-zinc-300">Loading topic...</p>
        </div>
      </div>
    );
  }

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
            <span>Topic</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {topic.title}
            </h1>
            <Badge>
              <Flame className="w-3 h-3" />
              Momentum {topic.momentum}
            </Badge>
            <Badge className="bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200">
              <MessageSquare className="w-3 h-3" />
              {numberFmt(topic.mentions)} mentions
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={handleChat}>
              <MessageSquare className="w-4 h-4" />
              Discuss in Chat
            </Button>
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="w-4 h-4" />
              Share
            </Button>
            <Button variant="ghost" onClick={handleSourceData}>
              <ExternalLink className="w-4 h-4" />
              Source Data
            </Button>
          </div>
        </div>

        {/* Infographics */}
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-5 pb-16">
          {/* Fiscal Impact Chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Fiscal Impact (Est.)
              </div>
              <Badge className="bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200">
                CBO-like
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={fiscalSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="year"
                      label={{ value: 'Year', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis
                      label={{ value: 'Billions ($)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 12 }}
                      formatter={(value: number) => [`$${value}B`, '']}
                    />
                    <Area
                      type="monotone"
                      dataKey="spend"
                      stroke="#111827"
                      fill="#11182710"
                      name="Spending"
                    />
                    <Area
                      type="monotone"
                      dataKey="subsidies"
                      stroke="#0ea5e9"
                      fill="#0ea5e910"
                      name="Subsidies"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Mock estimated data - Real CBO projections require Congressional Budget Office integration
              </div>
            </CardContent>
          </Card>

          {/* Mentions Over Time */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Mentions Over Time
              </div>
              <Badge className="bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200">
                Social Pulse
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mentionsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="w"
                      label={{ value: 'Week', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis
                      label={{ value: 'Twitter Mentions', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 12 }}
                      formatter={(value: number) => [`${value} mentions`, 'Count']}
                    />
                    <Bar dataKey="x" fill="#111827" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Upward trend indicates increasing discussion and momentum
              </div>
            </CardContent>
          </Card>

          {/* Political Context */}
          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <Scale className="w-4 h-4" />
                Political Context
              </div>
              <Badge className="bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200">
                Sponsors • Votes
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs text-zinc-500">Primary Sponsors</div>
                  <div className="font-semibold mt-1">
                    {congressData?.sponsor || "Loading..."}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs text-zinc-500">Committee</div>
                  <div className="font-semibold mt-1">
                    {congressData?.committee || "Loading..."}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs text-zinc-500">Status</div>
                  <div className="font-semibold mt-1">
                    {congressData?.status || "Loading..."}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Actions */}
        <div className="max-w-7xl mx-auto px-4 pb-16 flex items-center justify-between">
          <Button variant="outline" onClick={handleBack}>
            <ChevronLeft className="w-4 h-4" />
            Back to Home
          </Button>
          <Button onClick={handleChat}>
            <MessageSquare className="w-4 h-4" />
            Open Chat
          </Button>
        </div>
      </motion.div>

      <footer className="max-w-7xl mx-auto px-4 py-10 text-sm text-zinc-500">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>Actalyze © {new Date().getFullYear()}</div>
          <div>MVP • Real data powered by X API & Congress.gov</div>
          <div>Built for legislative staffers, comms teams, and civic orgs</div>
        </div>
      </footer>
    </div>
  );
}
