"use client";

import { TrendingUp } from "lucide-react";
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
}

interface TopicCardProps {
  topic: Topic;
  rank: number;
  onOpen: (topic: Topic) => void;
}

function numberFmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toString();
}

export default function TopicCard({ topic, rank, onOpen }: TopicCardProps) {
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
        <div className="text-xs text-zinc-500 whitespace-nowrap">
          {numberFmt(topic.mentions)} mentions
        </div>
      </CardHeader>
      <CardContent>
        {/* Chart with SERPAPI data */}
        <div className="mb-3">
          <TopicChart topic={topic.title} />
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
