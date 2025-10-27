"use client";

import { Filter } from "lucide-react";
import { Button } from "./ui/Button";
import TopicCard from "./TopicCard";

interface Topic {
  id: string;
  title: string;
  tags: string[];
  mentions: number;
  momentum: number;
  cost: number;
  color: string;
}

interface TrendingGridProps {
  topics: Topic[];
  onOpen: (topic: Topic) => void;
}

export default function TrendingGrid({ topics, onOpen }: TrendingGridProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 pb-16">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
          Trending Topics
        </h2>
        <Button variant="ghost">
          <Filter className="w-4 h-4" />
          Filter
        </Button>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {topics.map((topic, index) => (
          <TopicCard key={topic.id} topic={topic} rank={index + 1} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}
