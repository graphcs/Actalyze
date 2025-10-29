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
  Scale,
  Twitter,
  Newspaper,
} from "lucide-react";
import Nav from "../../components/Nav";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardHeader, CardContent } from "../../components/ui/Card";

interface Topic {
  id: string;
  title: string;
  tags: string[];
  mentions: number;
  momentum: number;
  cost: number;
  color: string;
}

interface PartyPerspectives {
  democrats: {
    summary: string;
    talkingPoints: string[];
    citations?: string[];
  };
  republicans: {
    summary: string;
    talkingPoints: string[];
    citations?: string[];
  };
}

interface Tweet {
  text: string;
  author: string;
  engagement: number;
  url?: string;
}

interface Headline {
  title: string;
  url: string;
  source: string;
  date?: string;
  thumbnail?: string;
}

function numberFmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toString();
}

function getHeatColor(score: number): string {
  if (score >= 90) {
    return "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800";
  } else if (score >= 70) {
    return "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800";
  } else {
    return "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800";
  }
}

export default function TopicPage() {
  const params = useParams();
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [perspectives, setPerspectives] = useState<PartyPerspectives | null>(null);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [headlines, setHeadlines] = useState<Headline[]>([]);
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

          // Once we have the topic, fetch related data
          const topicTitle = foundTopic.title;

          // Fetch party perspectives
          fetch(`/api/topic/perspectives?topic=${encodeURIComponent(topicTitle)}`)
            .then((res) => res.json())
            .then((data) => setPerspectives(data))
            .catch((error) => {
              console.error("Error fetching perspectives:", error);
              setPerspectives({
                democrats: {
                  summary: "Unable to load perspective.",
                  talkingPoints: [],
                },
                republicans: {
                  summary: "Unable to load perspective.",
                  talkingPoints: [],
                },
              });
            });

          // Fetch tweets
          fetch(`/api/topic/tweets?topic=${encodeURIComponent(topicTitle)}`)
            .then((res) => res.json())
            .then((data) => setTweets(data.tweets || []))
            .catch((error) => {
              console.error("Error fetching tweets:", error);
              setTweets([]);
            });

          // Fetch headlines
          fetch(`/api/topic/headlines?topic=${encodeURIComponent(topicTitle)}`)
            .then((res) => res.json())
            .then((data) => setHeadlines(data.headlines || []))
            .catch((error) => {
              console.error("Error fetching headlines:", error);
              setHeadlines([]);
            });
        }
      })
      .catch((error) => {
        console.error("Error fetching topic:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [params.id]);

  const handleBack = () => {
    router.push("/");
  };

  const handleChat = () => {
    if (topic) {
      router.push(`/chatbot?topic=${encodeURIComponent(topic.title)}`);
    } else {
      router.push("/chatbot");
    }
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
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-semibold text-sm ${getHeatColor(topic.momentum)}`}
            >
              {topic.momentum >= 90 && (
                <Flame className="w-4 h-4 animate-pulse" />
              )}
              <span>{topic.momentum}° Heat</span>
            </div>
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
              View on X
            </Button>
          </div>
        </div>

        {/* Content Sections */}
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-5 pb-16">
          {/* Top Tweets */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <Twitter className="w-4 h-4" />
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
              ) : tweets.length === 0 ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  <div className="mb-2">Twitter data currently unavailable</div>
                  <a
                    href={`https://twitter.com/search?q=${encodeURIComponent(topic?.title || '')}&f=live`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                  >
                    View on X →
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  {tweets.slice(0, 3).map((tweet, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800"
                    >
                      <div className="text-sm text-zinc-900 dark:text-zinc-100 mb-2">
                        {tweet.text}
                      </div>
                      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                        <span>@{tweet.author}</span>
                        <span>{tweet.engagement.toLocaleString()} interactions</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Headlines */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <Newspaper className="w-4 h-4" />
                Top Headlines
              </div>
              <Badge className="bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100">
                News
              </Badge>
            </CardHeader>
            <CardContent>
              {headlines.length === 0 ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  No headlines available for this topic
                </div>
              ) : (
                <div className="space-y-3">
                  {headlines
                    .sort((a, b) => {
                      // Sort: headlines with thumbnails first, then without
                      if (a.thumbnail && !b.thumbnail) return -1;
                      if (!a.thumbnail && b.thumbnail) return 1;
                      return 0; // Keep original order within each group
                    })
                    .slice(0, 5)
                    .map((headline, i) => (
                    <a
                      key={i}
                      href={headline.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900/60 transition"
                    >
                      {headline.thumbnail && (
                        <img
                          src={headline.thumbnail}
                          alt={headline.title}
                          className="w-20 h-20 object-cover rounded flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-zinc-900 dark:text-zinc-100 font-medium mb-1 line-clamp-2">
                          {headline.title}
                        </div>
                        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                          <span>{headline.source}</span>
                          <ExternalLink className="w-3 h-3" />
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Political Context */}
          <Card className="md:col-span-2">
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
          <div>Trusted by congressional staffers and policy professionals</div>
          <div>AI-powered intelligence for modern governance</div>
        </div>
      </footer>
    </div>
  );
}
