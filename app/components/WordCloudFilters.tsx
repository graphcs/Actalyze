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
    <div className="bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          Configure Analysis
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Set parameters for word cloud generation
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Topic Input */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Search className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
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
              className="w-full pl-4 pr-4 py-3 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            />
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 ml-1">
            💡 Enter any political topic to discover trending words
          </p>
        </div>

        {/* Time Range */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <span>Time Range</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["24h", "7d", "30d"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                disabled={loading}
                className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group ${
                  timeRange === range
                    ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/20"
                    : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 border-2 border-zinc-200 dark:border-zinc-700"
                }`}
              >
                <span className="relative z-10">
                  {range === "24h" && "24 Hours"}
                  {range === "7d" && "7 Days"}
                  {range === "30d" && "30 Days"}
                </span>
                {timeRange === range && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Location Filter */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <span>Location</span>
          </label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-3 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all appearance-none cursor-pointer"
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
          <label className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-3">
            <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900/30">
              <Heart className="w-4 h-4 text-pink-600 dark:text-pink-400" />
            </div>
            Sentiment Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(["all", "positive", "negative", "neutral"] as const).map(
              (sentiment) => (
                <button
                  key={sentiment}
                  onClick={() => setSentimentType(sentiment)}
                  disabled={loading}
                  className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border-2 ${
                    sentimentType === sentiment
                      ? "bg-gradient-to-br from-pink-500 to-purple-600 text-white border-pink-400 dark:border-purple-500 shadow-lg shadow-pink-500/30 dark:shadow-purple-500/30 scale-[1.02]"
                      : "bg-white dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-pink-300 dark:hover:border-purple-600 hover:shadow-md hover:scale-[1.01]"
                  }`}
                >
                  {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
                </button>
              )
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-6 border-t-2 border-zinc-200 dark:border-zinc-800">
          <Button
            onClick={handleApply}
            disabled={loading || !topic.trim()}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-500/30 dark:shadow-purple-500/30 transition-all duration-200 hover:scale-[1.02] disabled:hover:scale-100 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
            className="px-6 py-3 rounded-xl border-2 border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500 bg-white dark:bg-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] disabled:hover:scale-100"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
