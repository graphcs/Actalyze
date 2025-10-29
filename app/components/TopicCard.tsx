"use client";

import { TrendingUp, Flame } from "lucide-react";
import { Card, CardHeader, CardContent } from "./ui/Card";
import { Badge } from "./ui/Badge";
import TopicChart from "./TopicChart";

interface Topic {
  id: string;
  title: string;
  tags: string[];
  mentions: number;
  momentum: number;
  cost: number;
  color: string;
  mentionsOverTime?: Array<{ day: number; count: number }>;
  thumbnails?: string[];
}

interface TopicCardProps {
  topic: Topic;
  rank: number;
  onOpen: (topic: Topic) => void;
}

function getHeatColor(score: number): { bg: string; text: string; border: string } {
  if (score >= 90) {
    return {
      bg: "bg-red-100 dark:bg-red-950/30",
      text: "text-red-700 dark:text-red-400",
      border: "border-red-300 dark:border-red-800",
    };
  } else if (score >= 70) {
    return {
      bg: "bg-orange-100 dark:bg-orange-950/30",
      text: "text-orange-700 dark:text-orange-400",
      border: "border-orange-300 dark:border-orange-800",
    };
  } else {
    return {
      bg: "bg-yellow-100 dark:bg-yellow-950/30",
      text: "text-yellow-700 dark:text-yellow-400",
      border: "border-yellow-300 dark:border-yellow-800",
    };
  }
}

export default function TopicCard({ topic, rank, onOpen }: TopicCardProps) {
  const heatColors = getHeatColor(topic.momentum);
  const isOnFire = topic.momentum >= 90;

  return (
    <Card
      className="hover:shadow-md transition cursor-pointer"
      onClick={() => onOpen(topic)}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <Badge className="bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
            <TrendingUp className="w-3 h-3" />
            #{rank}
          </Badge>
          <div className="font-semibold text-zinc-900 dark:text-white">
            {topic.title}
          </div>
        </div>
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${heatColors.bg} ${heatColors.text} ${heatColors.border}`}
          title="Heat score"
        >
          {isOnFire && (
            <Flame className="w-3 h-3 animate-pulse" />
          )}
          <span>{topic.momentum}</span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Chart and Thumbnail side-by-side */}
        <div className="mb-3 flex gap-3 items-center">
          <div className="flex-1 min-w-0">
            <TopicChart topic={topic.title} />
          </div>
          {topic.thumbnails && topic.thumbnails.length > 0 && (
            <img
              src={topic.thumbnails[0]}
              alt={topic.title}
              className="w-24 h-24 object-cover rounded border border-zinc-200 dark:border-zinc-700 flex-shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {topic.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
            >
              {tag}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
