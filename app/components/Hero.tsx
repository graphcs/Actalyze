"use client";

import dynamic from "next/dynamic";
import { TrendingUp, MessageSquare, Users, MapPinned } from "lucide-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Card, CardHeader, CardContent } from "./ui/Card";

// Dynamically import the map to avoid SSR issues
const StateHeatMap = dynamic(
  () => import("./StateHeatMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-900/40">
        <div className="text-sm text-zinc-600">Loading map...</div>
      </div>
    )
  }
);

import DistrictSearch from "./DistrictSearch";

interface HeroProps {
  onExplore: () => void;
  onChat: () => void;
}

export default function Hero({ onExplore, onChat }: HeroProps) {
  return (
    <div className="relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight text-zinc-900 dark:text-white">
            See What&apos;s Moving in Washington in Real Time
          </h1>
          <p className="text-zinc-600 dark:text-zinc-300 mt-4 text-lg">
            Actalyze merges AI reasoning, social pulse, and real-time
            visualization so you can track legislative momentum and share
            insights instantly.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" onClick={onExplore}>
              <TrendingUp className="w-5 h-5" />
              Explore Trending
            </Button>
            <Button size="lg" variant="outline" onClick={onChat}>
              <MessageSquare className="w-5 h-5" />
              Start a Chat
            </Button>
          </div>
          <div className="mt-6 flex items-center gap-3 text-sm text-zinc-500">
            <Users className="w-4 h-4" />
            Built for legislative staffers, comms teams, and civic orgs
          </div>
        </div>
        <Card className="relative">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="font-semibold text-zinc-900 dark:text-white">
              Political Landscape
            </div>
            <Badge className="bg-purple-100 text-purple-900 dark:bg-purple-900 dark:text-purple-100">
              <MapPinned className="w-3 h-3" />
              50 States
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="h-[360px] w-full rounded-xl overflow-hidden mb-4">
              <StateHeatMap />
            </div>
            <DistrictSearch />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
