"use client";

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
  if (!Array.isArray(topics) || topics.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-12 text-center">
          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Trending topics are unavailable right now
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            The live trends feed did not return any results. Please check back shortly.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 pb-16">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {topics.map((topic, index) => (
          <TopicCard key={topic.id} topic={topic} rank={index + 1} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}
