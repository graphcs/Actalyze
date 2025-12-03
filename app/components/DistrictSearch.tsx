"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin } from "lucide-react";
import { Button } from "./ui/Button";

// Generate list of all congressional districts
const generateDistrictSuggestions = (): string[] => {
  const districts: string[] = [];
  const states = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
  ];

  const districtCounts: Record<string, number> = {
    "CA": 52, "TX": 38, "FL": 28, "NY": 26, "PA": 17, "IL": 17, "OH": 15,
    "GA": 14, "NC": 14, "MI": 13, "NJ": 12, "VA": 11, "WA": 10, "AZ": 9,
    "MA": 9, "TN": 9, "IN": 9, "MO": 8, "MD": 8, "WI": 8, "CO": 8, "MN": 8,
    "SC": 7, "AL": 7, "LA": 6, "KY": 6, "OR": 6, "OK": 5, "CT": 5, "UT": 4,
    "IA": 4, "NV": 4, "AR": 4, "MS": 4, "KS": 4, "NM": 3, "NE": 3, "ID": 2,
    "WV": 2, "HI": 2, "NH": 2, "ME": 2, "RI": 2, "MT": 2, "DE": 1, "SD": 1,
    "ND": 1, "AK": 1, "VT": 1, "WY": 1
  };

  for (const state of states) {
    const count = districtCounts[state] || 1;
    if (count === 1) {
      districts.push(`${state}01`);
    } else {
      for (let i = 1; i <= count; i++) {
        districts.push(`${state}${i.toString().padStart(2, '0')}`);
      }
    }
  }

  return districts;
};

const ALL_DISTRICTS = generateDistrictSuggestions();

export default function DistrictSearch() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const parseDistrictCode = (input: string): string | null => {
    const cleaned = input.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');

    // Match patterns like: VA05, NY01, VA5
    const districtPattern = /^([A-Z]{2})(\d{1,2})$/;
    const match = cleaned.match(districtPattern);

    if (match) {
      const state = match[1];
      const district = match[2].padStart(2, '0');
      const fullCode = `${state}${district}`;

      // Validate it's a real district
      if (ALL_DISTRICTS.includes(fullCode)) {
        return fullCode;
      }
    }

    return null;
  };

  const handleSearch = () => {
    if (!query.trim()) return;

    const districtCode = parseDistrictCode(query);

    if (districtCode) {
      router.push(`/district/${districtCode.toLowerCase()}`);
    } else {
      alert("Please enter a valid district code like 'NY-01' or 'VA05'");
    }
  };

  // Update suggestions when query changes
  useEffect(() => {
    if (query.trim().length >= 1) {
      const cleaned = query.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
      const filtered = ALL_DISTRICTS.filter(district =>
        district.startsWith(cleaned)
      ).slice(0, 10);

      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [query]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSuggestionClick = (district: string) => {
    setQuery(district);
    setShowSuggestions(false);
    router.push(`/district/${district.toLowerCase()}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setShowSuggestions(false);
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const formatDistrictLabel = (district: string): string => {
    const state = district.substring(0, 2);
    const num = district.substring(2);
    return `${state}-${num}`;
  };

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <div className="relative flex-1" ref={suggestionsRef}>
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 z-10" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyPress}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            placeholder="Enter district (e.g., NY-01, VA05, CA12)"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent text-sm"
          />

          {/* Autocomplete suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
              {suggestions.map((district) => (
                <button
                  key={district}
                  onClick={() => handleSuggestionClick(district)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                >
                  <MapPin className="w-3 h-3 text-zinc-500" />
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatDistrictLabel(district)}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Congressional District
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button
          onClick={handleSearch}
          disabled={!query.trim()}
          className="whitespace-nowrap"
        >
          <Search className="w-4 h-4" />
          Search
        </Button>
      </div>
      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Examples: NY-01, VA05, CA-12, TX38
      </div>
    </div>
  );
}
