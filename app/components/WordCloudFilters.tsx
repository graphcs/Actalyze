/**
 * Word Cloud Filters Component
 * Allows users to filter word cloud by topic, time range, location, and sentiment
 */

"use client";

import { useState } from "react";
import { Search, Calendar, MapPin, Heart, RotateCcw } from "lucide-react";
import { Button } from "./ui/Button";
import type { WordCloudFilters } from "@/types/wordcloud";

interface WordCloudFiltersProps {
  onApply: (filters: WordCloudFilters) => void;
  onReset: () => void;
  loading?: boolean;
  initialFilters?: Partial<WordCloudFilters>;
}

export default function WordCloudFiltersComponent({
  onApply,
  onReset,
  loading = false,
  initialFilters = {},
}: WordCloudFiltersProps) {
  const [topic, setTopic] = useState(initialFilters.topic || "");
  const [timeRange, setTimeRange] = useState<WordCloudFilters["timeRange"]>(
    initialFilters.timeRange || "7d"
  );
  const [location, setLocation] = useState(
    initialFilters.location || "national"
  );
  const [sentimentType, setSentimentType] = useState<
    WordCloudFilters["sentimentType"]
  >(initialFilters.sentimentType || "all");

  const handleApply = () => {
    if (!topic.trim()) {
      alert("Please enter a topic or keyword");
      return;
    }

    onApply({
      topic: topic.trim(),
      timeRange,
      location,
      sentimentType,
    });
  };

  const handleReset = () => {
    setTopic("");
    setTimeRange("7d");
    setLocation("national");
    setSentimentType("all");
    onReset();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && topic.trim()) {
      handleApply();
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
      <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Configure Analysis
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Set parameters for word cloud generation
        </p>
      </div>

      <div className="p-5 space-y-5">
        {/* Topic Input */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
            <Search className="w-4 h-4 text-zinc-500" />
            <span>Topic or Keyword</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., healthcare, climate, immigration"
              disabled={loading}
              className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
            />
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
            Enter any political topic to discover trending words
          </p>
        </div>

        {/* Time Range */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
            <Calendar className="w-4 h-4 text-zinc-500" />
            <span>Time Range</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["24h", "7d", "30d"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                disabled={loading}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  timeRange === range
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {range === "24h" && "24 Hours"}
                {range === "7d" && "7 Days"}
                {range === "30d" && "30 Days"}
              </button>
            ))}
          </div>
        </div>

        {/* Location Filter */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
            <MapPin className="w-4 h-4 text-zinc-500" />
            <span>Location</span>
          </label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all appearance-none cursor-pointer text-sm"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: "right 0.5rem center",
              backgroundRepeat: "no-repeat",
              backgroundSize: "1.5em 1.5em",
              paddingRight: "2.5rem",
            }}
          >
            <option value="national">National</option>
            <option value="AL">Alabama</option>
            <option value="AK">Alaska</option>
            <option value="AZ">Arizona</option>
            <option value="AR">Arkansas</option>
            <option value="CA">California</option>
            <option value="CO">Colorado</option>
            <option value="CT">Connecticut</option>
            <option value="DE">Delaware</option>
            <option value="FL">Florida</option>
            <option value="GA">Georgia</option>
            <option value="HI">Hawaii</option>
            <option value="ID">Idaho</option>
            <option value="IL">Illinois</option>
            <option value="IN">Indiana</option>
            <option value="IA">Iowa</option>
            <option value="KS">Kansas</option>
            <option value="KY">Kentucky</option>
            <option value="LA">Louisiana</option>
            <option value="ME">Maine</option>
            <option value="MD">Maryland</option>
            <option value="MA">Massachusetts</option>
            <option value="MI">Michigan</option>
            <option value="MN">Minnesota</option>
            <option value="MS">Mississippi</option>
            <option value="MO">Missouri</option>
            <option value="MT">Montana</option>
            <option value="NE">Nebraska</option>
            <option value="NV">Nevada</option>
            <option value="NH">New Hampshire</option>
            <option value="NJ">New Jersey</option>
            <option value="NM">New Mexico</option>
            <option value="NY">New York</option>
            <option value="NC">North Carolina</option>
            <option value="ND">North Dakota</option>
            <option value="OH">Ohio</option>
            <option value="OK">Oklahoma</option>
            <option value="OR">Oregon</option>
            <option value="PA">Pennsylvania</option>
            <option value="RI">Rhode Island</option>
            <option value="SC">South Carolina</option>
            <option value="SD">South Dakota</option>
            <option value="TN">Tennessee</option>
            <option value="TX">Texas</option>
            <option value="UT">Utah</option>
            <option value="VT">Vermont</option>
            <option value="VA">Virginia</option>
            <option value="WA">Washington</option>
            <option value="WV">West Virginia</option>
            <option value="WI">Wisconsin</option>
            <option value="WY">Wyoming</option>
            <option value="DC">Washington D.C.</option>
          </select>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Note: Location filter may not work with Twitter Free tier
          </p>
        </div>

        {/* Sentiment Filter */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
            <Heart className="w-4 h-4 text-zinc-500" />
            Sentiment Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["all", "positive", "negative", "neutral"] as const).map(
              (sentiment) => {
                const isSelected = sentimentType === sentiment;
                const getSentimentStyle = () => {
                  if (!isSelected) return "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700";
                  switch (sentiment) {
                    case "positive": return "bg-green-600 text-white";
                    case "negative": return "bg-red-600 text-white";
                    case "neutral": return "bg-blue-600 text-white";
                    default: return "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900";
                  }
                };
                return (
                  <button
                    key={sentiment}
                    onClick={() => setSentimentType(sentiment)}
                    disabled={loading}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${getSentimentStyle()}`}
                  >
                    {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <Button
            onClick={handleApply}
            disabled={loading || !topic.trim()}
            className="flex-1 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 dark:border-zinc-900/30 border-t-white dark:border-t-zinc-900 rounded-full animate-spin" />
                Generating...
              </span>
            ) : (
              "Generate Word Cloud"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={loading}
            className="px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
