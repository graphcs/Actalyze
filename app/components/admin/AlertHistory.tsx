/**
 * Alert History Component
 * Displays recent alert notifications
 */

"use client";

import { useState } from "react";
import {
  History,
  TrendingUp,
  Heart,
  User,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { AlertHistoryEntry, AlertType } from "@/types/alerts";

interface AlertHistoryProps {
  history: AlertHistoryEntry[];
  loading?: boolean;
}

const ALERT_TYPE_INFO: Record<AlertType, { label: string; icon: React.ElementType; color: string }> = {
  issue_surge: {
    label: "Issue Surge",
    icon: TrendingUp,
    color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20",
  },
  sentiment_shift: {
    label: "Sentiment Shift",
    icon: Heart,
    color: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20",
  },
  rep_mention: {
    label: "Rep Mention",
    icon: User,
    color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20",
  },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
}

function HistoryItem({ entry }: { entry: AlertHistoryEntry }) {
  const [expanded, setExpanded] = useState(false);
  const info = ALERT_TYPE_INFO[entry.alert_type];
  const Icon = info.icon;

  const getStatusIcon = () => {
    switch (entry.delivery_status) {
      case "sent":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${info.color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {entry.message}
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>{info.label}</span>
              <span>&bull;</span>
              <span>{formatDate(entry.sent_at)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </div>
      </button>

      {expanded && entry.details && (
        <div className="px-3 pb-3 pt-0">
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 text-sm">
            {entry.details.topic && (
              <div className="flex justify-between py-1">
                <span className="text-zinc-500 dark:text-zinc-400">Topic</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{entry.details.topic}</span>
              </div>
            )}
            {entry.details.representative_name && (
              <div className="flex justify-between py-1">
                <span className="text-zinc-500 dark:text-zinc-400">Representative</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{entry.details.representative_name}</span>
              </div>
            )}
            {entry.details.district_code && (
              <div className="flex justify-between py-1">
                <span className="text-zinc-500 dark:text-zinc-400">Location</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {entry.details.district_code === "national" ? "National" : entry.details.district_code}
                </span>
              </div>
            )}
            {entry.details.current_score !== undefined && (
              <div className="flex justify-between py-1">
                <span className="text-zinc-500 dark:text-zinc-400">Current Score</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {entry.details.current_score.toFixed(1)}
                </span>
              </div>
            )}
            {entry.details.baseline_score !== undefined && (
              <div className="flex justify-between py-1">
                <span className="text-zinc-500 dark:text-zinc-400">Baseline Score</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {entry.details.baseline_score.toFixed(1)}
                </span>
              </div>
            )}
            {entry.details.current_sentiment !== undefined && (
              <div className="flex justify-between py-1">
                <span className="text-zinc-500 dark:text-zinc-400">Current Sentiment</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {entry.details.current_sentiment.toFixed(2)}
                </span>
              </div>
            )}
            {entry.details.baseline_sentiment !== undefined && (
              <div className="flex justify-between py-1">
                <span className="text-zinc-500 dark:text-zinc-400">Baseline Sentiment</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {entry.details.baseline_sentiment.toFixed(2)}
                </span>
              </div>
            )}
            {entry.details.mention_count !== undefined && (
              <div className="flex justify-between py-1">
                <span className="text-zinc-500 dark:text-zinc-400">Mentions</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {entry.details.mention_count}
                </span>
              </div>
            )}
            {entry.details.sample_tweets && entry.details.sample_tweets.length > 0 && (
              <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                <div className="text-zinc-500 dark:text-zinc-400 mb-2">Sample Tweets</div>
                <div className="space-y-2">
                  {entry.details.sample_tweets.slice(0, 3).map((tweet, i) => (
                    <div key={i} className="text-xs text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 p-2 rounded border border-zinc-200 dark:border-zinc-700">
                      {tweet}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-between py-1 mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
              <span className="text-zinc-500 dark:text-zinc-400">Delivery Status</span>
              <span className={`font-medium ${
                entry.delivery_status === "sent"
                  ? "text-green-600 dark:text-green-400"
                  : entry.delivery_status === "failed"
                  ? "text-red-600 dark:text-red-400"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}>
                {entry.delivery_status}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AlertHistory({ history, loading = false }: AlertHistoryProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <History className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Alert History
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Loading...
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <History className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Alert History
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Recent notifications ({history.length})
          </p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700">
          <History className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
          <p className="text-zinc-500 dark:text-zinc-400">
            No alerts triggered yet
          </p>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
            Alerts will appear here when triggered
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((entry) => (
            <HistoryItem key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
