"use client";

import { TrendingUp } from "lucide-react";
import { Card, CardHeader, CardContent } from "./ui/Card";
import { Badge } from "./ui/Badge";
import Sparkline, { generateSparkData } from "./Sparkline";

interface Topic {
  id: string;
  title: string;
  tags: string[];
  mentions: number;
  momentum: number;
  cost: number;
  color: string;
}

interface TopicCardProps {
  topic: Topic;
  onOpen: (topic: Topic) => void;
}

function numberFmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toString();
}

export default function TopicCard({ topic, onOpen }: TopicCardProps) {
  const sparkData = generateSparkData();

  return (
    <Card
      className="hover:shadow-md transition cursor-pointer"
      onClick={() => onOpen(topic)}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <Badge className="bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
            <TrendingUp className="w-3 h-3" />
            #{Math.floor(topic.momentum)}
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
        <div className="grid grid-cols-3 gap-4 items-center">
          <div className="col-span-2">
            <Sparkline data={sparkData} stroke={topic.color} />
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500">Est. Cost</div>
            <div className="text-lg font-semibold text-zinc-900 dark:text-white">
              ${topic.cost}B
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
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
