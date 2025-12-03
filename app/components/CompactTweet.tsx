"use client";

import { Heart, Repeat2, MessageCircle, ExternalLink } from "lucide-react";

interface CompactTweetProps {
  id: string;
  text: string;
  author: string;
  username: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  created_at?: string;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CompactTweet({
  id,
  text,
  author,
  username,
  likes = 0,
  retweets = 0,
  replies = 0,
  created_at,
}: CompactTweetProps) {
  const tweetUrl = `https://twitter.com/${username}/status/${id}`;

  // Truncate text to ~140 chars
  const truncatedText = text.length > 140 ? text.slice(0, 140) + '...' : text;

  return (
    <a
      href={tweetUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition group"
    >
      {/* Header: Author + Time */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
            {author}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            @{username}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-zinc-400 flex-shrink-0">
          {created_at && <span>{formatDate(created_at)}</span>}
          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Tweet Text */}
      <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-snug mb-2">
        {truncatedText}
      </p>

      {/* Engagement Metrics */}
      <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        {likes > 0 && (
          <div className="flex items-center gap-1">
            <Heart className="w-3.5 h-3.5 text-red-400" />
            <span>{formatNumber(likes)}</span>
          </div>
        )}
        {retweets > 0 && (
          <div className="flex items-center gap-1">
            <Repeat2 className="w-3.5 h-3.5 text-green-400" />
            <span>{formatNumber(retweets)}</span>
          </div>
        )}
        {replies > 0 && (
          <div className="flex items-center gap-1">
            <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
            <span>{formatNumber(replies)}</span>
          </div>
        )}
        {likes === 0 && retweets === 0 && replies === 0 && (
          <span className="text-zinc-400">New tweet</span>
        )}
      </div>
    </a>
  );
}
