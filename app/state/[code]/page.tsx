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
  TrendingUp,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import Nav from "../../components/Nav";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardHeader, CardContent } from "../../components/ui/Card";
import { fetchWithCache } from "@/src/lib/fetchWithCache";

// Dynamically import map to avoid SSR issues
const StateViewMap = dynamic(
  () => import("../../components/StateViewMap"),
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

// Dynamically import RedditEmbed to avoid SSR issues
const RedditEmbed = dynamic(
  () => import("../../components/RedditEmbed"),
  { ssr: false }
);

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
  "DC": "District of Columbia"
};

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

interface RedditPost {
  id: string;
  title: string;
  permalink: string;
  author: string;
  subreddit: string;
  score: number;
  num_comments: number;
  created_utc: number;
  url: string;
}

export default function StatePage() {
  const params = useParams();
  const router = useRouter();
  const stateCode = (params.code as string)?.toUpperCase();
  const stateName = STATE_NAMES[stateCode];

  const [issues, setIssues] = useState<string[]>([]);
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [pollingData, setPollingData] = useState<{ trend: string | null; description: string } | null>(null);
  const [perspectives, setPerspectives] = useState<PartyPerspectives | null>(null);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [redditPosts, setRedditPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stateCode || !stateName) return;

    // Fetch state data in parallel
    Promise.all([
      fetchWithCache(`/api/map/state-news?state=${stateCode}`).then(res => res.json()),
      fetchWithCache(`/api/state/news?state=${stateCode}`).then(res => res.json()),
      fetchWithCache(`/api/state/polling?state=${stateCode}`).then(res => res.json()),
      fetch(`/api/tweets/search?query=${encodeURIComponent(stateName)} politics&limit=4`).then(res => res.json()),
      fetch(`/api/reddit/search?query=${encodeURIComponent(stateName)}&limit=4`).then(res => res.json()),
    ])
      .then(([mapData, newsData, polling, tweetsData, redditData]) => {
        setIssues(mapData.issues || []);
        setHeadlines(newsData.headlines || []);
        setPollingData(polling);
        setTweets(tweetsData.tweets || []);
        setRedditPosts(redditData.posts || []);

        // Generate perspectives based on news
        // In a real app, this would be an API call
        setPerspectives({
          democrats: {
            summary: `Democrats in ${stateName} are focusing on healthcare expansion and education funding.`,
            talkingPoints: ["Expand Medicaid access", "Increase teacher pay", "Protect voting rights"]
          },
          republicans: {
            summary: `Republicans in ${stateName} are emphasizing tax cuts and deregulation to spur growth.`,
            talkingPoints: ["Reduce state income tax", "Cut business regulations", "Support law enforcement"]
          }
        });
      })
      .catch((error) => {
        console.error("Error fetching state data:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [stateCode, stateName]);

  const handleBack = () => {
    router.push("/");
  };

  const handleChat = () => {
    router.push(`/chatbot?topic=${stateName}`);
  };

  if (!stateCode || !stateName) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
        <div className="text-center">
          <p className="text-zinc-600 dark:text-zinc-300">Invalid state code</p>
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
            <span>State</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {stateName}
            </h1>
            <Badge className="bg-purple-100 text-purple-900 dark:bg-purple-900 dark:text-purple-100">
              <MapPin className="w-3 h-3" />
              {stateCode}
            </Badge>
          </div>
        </div>

        {/* Map and News Grid */}
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-5 pb-8">
          {/* State Map */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                State Map
              </div>
              <Badge className="bg-purple-100 text-purple-900 dark:bg-purple-900 dark:text-purple-100">
                {stateCode}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full h-[400px]">
                <StateViewMap
                  stateCode={stateCode}
                  pollingTrend={pollingData?.trend}
                />
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

        {/* Issues and Polling Grid */}
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-5 pb-8">
          {/* Top Issues */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Top Issues
              </div>
              <Badge className="bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100">
                State
              </Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  Loading issues...
                </div>
              ) : issues.length === 0 ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  No issues data available
                </div>
              ) : (
                <ul className="space-y-2">
                  {issues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-purple-500 dark:text-purple-400 mt-1">•</span>
                      <span className="text-zinc-700 dark:text-zinc-300">{issue}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recent Polling */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <Newspaper className="w-4 h-4" />
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
                  No tweets found for {stateName}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Reddit Discussions */}
        <div className="max-w-7xl mx-auto px-4 pb-16">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Top Reddit Discussions
              </div>
              <Badge className="bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-100">
                Reddit
              </Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  Loading discussions...
                </div>
              ) : redditPosts.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {redditPosts.map((post) => (
                    <div key={post.id}>
                      <RedditEmbed url={`https://www.reddit.com${post.permalink}`} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  No discussions found for {stateName}
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
