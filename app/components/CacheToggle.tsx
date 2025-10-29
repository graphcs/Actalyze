"use client";

import { useState, useEffect } from "react";
import { Zap, ZapOff } from "lucide-react";

export default function CacheToggle() {
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('cacheEnabled');
    if (saved !== null) {
      setCacheEnabled(saved === 'true');
    }
    setMounted(true);
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('cacheEnabled', String(cacheEnabled));
    }
  }, [cacheEnabled, mounted]);

  const toggleCache = () => {
    setCacheEnabled(!cacheEnabled);
  };

  if (!mounted) {
    return null; // Avoid hydration mismatch
  }

  return (
    <button
      onClick={toggleCache}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border"
      style={{
        backgroundColor: cacheEnabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        borderColor: cacheEnabled ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
        color: cacheEnabled ? 'rgb(22, 163, 74)' : 'rgb(220, 38, 38)',
      }}
      title={cacheEnabled ? 'Cache enabled: Fast loading with 1hr cache' : 'Cache disabled: Always fresh data'}
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
  );
}

/**
 * Hook to get cache preference in API calls
 */
export function useCachePreference(): boolean {
  const [cacheEnabled, setCacheEnabled] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('cacheEnabled');
    if (saved !== null) {
      setCacheEnabled(saved === 'true');
    }
  }, []);

  return cacheEnabled;
}
