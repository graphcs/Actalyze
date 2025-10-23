"use client";

import { TrendingUp, Upload, MessageSquare, Users, MapPinned } from "lucide-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Card, CardHeader, CardContent } from "./ui/Card";

interface HeroProps {
  onExplore: () => void;
  onUpload: () => void;
  onChat: () => void;
}

const USAMapEmbed = () => (
  <iframe
    title="USA Map"
    className="w-full h-full border-0 rounded-xl"
    src="https://www.openstreetmap.org/export/embed.html?bbox=-129.6%2C24.3%2C-66.9%2C49.4&layer=mapnik"
  />
);

export default function Hero({ onExplore, onUpload, onChat }: HeroProps) {
  return (
    <div className="relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight text-zinc-900 dark:text-white">
            See What&apos;s Moving in Washington — in Real Time
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
            <Button size="lg" variant="outline" onClick={onUpload}>
              <Upload className="w-5 h-5" />
              Upload a Bill
            </Button>
            <Button size="lg" variant="ghost" onClick={onChat}>
              <MessageSquare className="w-5 h-5" />
              Start a Chat
            </Button>
          </div>
          <div className="mt-6 flex items-center gap-3 text-sm text-zinc-500">
            <Users className="w-4 h-4" />
            Built for analysts, comms teams, and civic orgs
          </div>
        </div>
        <Card className="relative">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="font-semibold text-zinc-900 dark:text-white">
              Policy Pulse Map
            </div>
            <Badge className="bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
              <MapPinned className="w-3 h-3" />
              States
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="h-[360px] w-full rounded-xl overflow-hidden">
              <USAMapEmbed />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
