"use client";

import { useState, useEffect, useRef } from "react";
import { Zap, ZapOff, ChevronDown } from "lucide-react";

// Cache duration options
const CACHE_DURATIONS = [
  { value: '15m', label: '15 min', seconds: 15 * 60 },
  { value: '1h', label: '1 hour', seconds: 60 * 60 },
  { value: '6h', label: '6 hours', seconds: 6 * 60 * 60 },
  { value: '24h', label: '24 hours', seconds: 24 * 60 * 60 },
];

export default function CacheToggle() {
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [cacheDuration, setCacheDuration] = useState('24h'); // Default to 24 hours
  const [showDropdown, setShowDropdown] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedEnabled = localStorage.getItem('cacheEnabled');
    if (savedEnabled !== null) {
      setCacheEnabled(savedEnabled === 'true');
    }
    const savedDuration = localStorage.getItem('cacheDuration');
    if (savedDuration) {
      setCacheDuration(savedDuration);
    }
    setMounted(true);
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('cacheEnabled', String(cacheEnabled));
      localStorage.setItem('cacheDuration', cacheDuration);
    }
  }, [cacheEnabled, cacheDuration, mounted]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleCache = () => {
    setCacheEnabled(!cacheEnabled);
  };

  const handleDurationChange = (value: string) => {
    setCacheDuration(value);
    setShowDropdown(false);
  };

  if (!mounted) {
    return null; // Avoid hydration mismatch
  }

  const currentDuration = CACHE_DURATIONS.find(d => d.value === cacheDuration) || CACHE_DURATIONS[3]; // Default to 24h

  return (
    <div className="flex items-center gap-2" ref={dropdownRef}>
      {/* Cache toggle button */}
      <button
        onClick={toggleCache}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border"
        style={{
          backgroundColor: cacheEnabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          borderColor: cacheEnabled ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
          color: cacheEnabled ? 'rgb(22, 163, 74)' : 'rgb(220, 38, 38)',
        }}
        title={cacheEnabled ? `Cache enabled: Using ${currentDuration.label} cache` : 'Cache disabled: Always fresh data (still writes to cache)'}
      >
        {cacheEnabled ? (
          <>
            <Zap className="w-3 h-3" />
            <span>Cache ON</span>
          </>
        ) : (
          <>
            <ZapOff className="w-3 h-3" />
            <span>Cache OFF</span>
          </>
        )}
      </button>

      {/* Duration dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700"
          title="Cache duration"
        >
          <span className="text-zinc-600 dark:text-zinc-400">{currentDuration.label}</span>
          <ChevronDown className="w-3 h-3 text-zinc-400" />
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 min-w-[100px]">
            {CACHE_DURATIONS.map((duration) => (
              <button
                key={duration.value}
                onClick={() => handleDurationChange(duration.value)}
                className={`w-full px-3 py-2 text-xs text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  cacheDuration === duration.value
                    ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {duration.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to get cache preference in API calls
 */
export function useCachePreference(): { enabled: boolean; duration: string; durationSeconds: number } {
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [cacheDuration, setCacheDuration] = useState('24h'); // Default to 24 hours

  useEffect(() => {
    const savedEnabled = localStorage.getItem('cacheEnabled');
    if (savedEnabled !== null) {
      setCacheEnabled(savedEnabled === 'true');
    }
    const savedDuration = localStorage.getItem('cacheDuration');
    if (savedDuration) {
      setCacheDuration(savedDuration);
    }
  }, []);

  const durationConfig = CACHE_DURATIONS.find(d => d.value === cacheDuration) || CACHE_DURATIONS[3]; // Default to 24h

  return {
    enabled: cacheEnabled,
    duration: cacheDuration,
    durationSeconds: durationConfig.seconds,
  };
}
