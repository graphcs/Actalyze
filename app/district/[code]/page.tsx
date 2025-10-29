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
} from "lucide-react";
import Nav from "../../components/Nav";
import DistrictSearch from "../../components/DistrictSearch";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardHeader, CardContent } from "../../components/ui/Card";

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

export default function DistrictPage() {
  const params = useParams();
  const router = useRouter();
  const districtCode = (params.code as string)?.toUpperCase();

  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [perspectives, setPerspectives] = useState<PartyPerspectives | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!districtCode) return;

    // Fetch district data in parallel
    Promise.all([
      fetch(`/api/district/news?district=${districtCode}`).then(res => res.json()),
      fetch(`/api/district/summary?district=${districtCode}`).then(res => res.json()),
      fetch(`/api/topic/perspectives?topic=${districtCode} district`).then(res => res.json()),
    ])
      .then(([newsData, summaryData, perspectivesData]) => {
        setHeadlines(newsData.headlines || []);
        setSummary(summaryData.summary || "");
        setPerspectives(perspectivesData);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching district data:", error);
        setLoading(false);
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
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full rounded-xl overflow-hidden">
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
              <Badge className="bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100">
                Headlines
              </Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  Loading local news...
                </div>
              ) : headlines.length === 0 ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
                  No local news available
                </div>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto">
                  {headlines.map((headline, i) => (
                    <a
                      key={i}
                      href={headline.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900/60 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-zinc-900 dark:text-zinc-100 font-medium mb-1 line-clamp-2">
                            {headline.title}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {headline.source}
                          </div>
                        </div>
                        <ExternalLink className="w-3 h-3 text-zinc-400 flex-shrink-0 mt-1" />
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* District Summary */}
        <div className="max-w-7xl mx-auto px-4 pb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="font-semibold">District News Summary</div>
              <Badge className="bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100">
                This Week
              </Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
                  Generating summary...
                </div>
              ) : (
                <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {summary}
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
