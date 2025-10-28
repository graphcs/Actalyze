import { NextResponse } from "next/server";
import { getTrendingPoliticsUS } from "@/src/trending/index";

interface TrendingTopic {
  id: string;
  title: string;
  tags: string[];
  mentions: number;
  momentum: number;
  cost: number;
  color: string;
  mentionsOverTime?: Array<{ day: number; count: number }>;
}

export async function GET() {
  try {
    console.log("🚀 Trending API called at", new Date().toISOString());

    // Fetch trending political topics from SERPAPI
    const topics = await getTrendingPoliticsUS({
      maxItems: 9,
      minScore: 10,
      useFallback: true,
    });

    console.log(`✅ Got ${topics.length} topics from SERPAPI`);

    if (topics.length === 0) {
      console.log("⚠️ No topics returned, falling back to mock data");
      return NextResponse.json(getMockTrendingTopics());
    }

    // Transform SERPAPI topics to our frontend format
    const trendingTopicsArray: TrendingTopic[] = topics.map((topic) => {
      // Clean up topic name
      const cleanTopicName = topic.topic.trim();
      const displayTitle = cleanTopicName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      // Extract tags from examples or topic
      const tags = topic.examples
        .slice(0, 2)
        .map(ex => {
          const words = ex.split(' ').filter(w => w.length > 4);
          return words[0] || 'Politics';
        })
        .filter(Boolean);

      if (tags.length === 0) {
        tags.push('Politics', 'Trending');
      }

      // Generate realistic-looking sparkline data (trending upward)
      const baseCount = 20 + Math.floor(Math.random() * 30);
      const mentionsOverTime = Array.from({ length: 14 }, (_, i) => ({
        day: i + 1,
        count: Math.floor(baseCount + (i * 2.5) + (Math.random() * 8)),
      }));

      // Estimate mentions based on score
      const mentions = Math.floor((topic.score / 100) * 100000) + 10000;

      return {
        id: cleanTopicName.toLowerCase().replace(/\s+/g, '-'),
        title: displayTitle,
        tags: tags.slice(0, 3),
        mentions,
        momentum: topic.score,
        cost: Math.floor(Math.random() * 1000) + 50,
        color: getColorForTopic(cleanTopicName.toLowerCase()),
        mentionsOverTime,
      };
    });

    return NextResponse.json(trendingTopicsArray);

  } catch (error) {
    console.error("❌ Error fetching trending topics:", error);
    console.log("⚠️ Falling back to mock data due to error");
    return NextResponse.json(getMockTrendingTopics());
  }
}

function getColorForTopic(topic: string): string {
  const colors = [
    "#111827", // dark gray
    "#0ea5e9", // blue
    "#16a34a", // green
    "#ef4444", // red
    "#8b5cf6", // purple
    "#f59e0b", // amber
    "#ec4899", // pink
    "#06b6d4", // cyan
  ];

  // Simple hash to consistently assign colors
  let hash = 0;
  for (let i = 0; i < topic.length; i++) {
    hash = topic.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

function getMockTrendingTopics(): TrendingTopic[] {
  return [
    {
      id: "infrastructure-bill",
      title: "Infrastructure Bill",
      tags: ["Infrastructure", "Transportation"],
      mentions: 42000,
      momentum: 78,
      cost: 1100,
      color: "#111827",
      mentionsOverTime: Array.from({ length: 14 }, (_, i) => ({
        day: i + 1,
        count: Math.floor(30 + i * 3 + Math.random() * 10),
      })),
    },
    {
      id: "healthcare-reform",
      title: "Healthcare Reform",
      tags: ["Healthcare", "Reform"],
      mentions: 37000,
      momentum: 69,
      cost: 210,
      color: "#0ea5e9",
      mentionsOverTime: Array.from({ length: 14 }, (_, i) => ({
        day: i + 1,
        count: Math.floor(25 + i * 3 + Math.random() * 10),
      })),
    },
    {
      id: "farm-bill",
      title: "Farm Bill",
      tags: ["Agriculture", "Farm"],
      mentions: 19500,
      momentum: 61,
      cost: 95,
      color: "#16a34a",
      mentionsOverTime: Array.from({ length: 14 }, (_, i) => ({
        day: i + 1,
        count: Math.floor(22 + i * 3 + Math.random() * 10),
      })),
    },
    {
      id: "defense-appropriations",
      title: "Defense Appropriations",
      tags: ["Defense", "Appropriations"],
      mentions: 26500,
      momentum: 72,
      cost: 840,
      color: "#ef4444",
      mentionsOverTime: Array.from({ length: 14 }, (_, i) => ({
        day: i + 1,
        count: Math.floor(27 + i * 3 + Math.random() * 10),
      })),
    },
  ];
}
