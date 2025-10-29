"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin } from "lucide-react";
import { Button } from "./ui/Button";

export default function DistrictSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const parseDistrictCode = (input: string): string | null => {
    const cleaned = input.trim().toUpperCase().replace(/\s+/g, '');

    // Match patterns like: VA05, NY-01, NY01, VA-5
    const districtPattern = /^([A-Z]{2})-?(\d{1,2})$/;
    const match = cleaned.match(districtPattern);

    if (match) {
      const state = match[1];
      const district = match[2].padStart(2, '0'); // Ensure 2-digit format
      return `${state}${district}`;
    }

    // Also support full state names like "Virginia 5th" or "New York 1"
    const fullNamePattern = /^([A-Z\s]+)\s+(\d{1,2})(ST|ND|RD|TH)?$/i;
    const fullMatch = cleaned.match(fullNamePattern);

    if (fullMatch) {
      // This would require a state name to code mapping
      // For now, return null and we can add this feature later
      return null;
    }

    return null;
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);

    // Try to parse as district code first
    const districtCode = parseDistrictCode(query);

    if (districtCode) {
      // Navigate to district page
      router.push(`/district/${districtCode.toLowerCase()}`);
    } else {
      // Try geocoding for address
      try {
        const response = await fetch(`/api/district/geocode?address=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.district) {
          router.push(`/district/${data.district.toLowerCase()}`);
        } else {
          alert("Could not find district for that address. Please try a district code like 'VA05' or 'NY-01'.");
        }
      } catch (error) {
        console.error("Geocoding error:", error);
        alert("Error finding district. Please try a district code like 'VA05' or 'NY-01'.");
      }
    }

    setLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search district (e.g., VA05, NY-01) or address..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            disabled={loading}
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="whitespace-nowrap"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Search
            </>
          )}
        </Button>
      </div>
      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Try: &quot;VA05&quot;, &quot;NY-01&quot;, or enter an address
      </div>
    </div>
  );
}
