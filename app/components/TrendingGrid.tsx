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
