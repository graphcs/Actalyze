"use client";

import { useEffect, useRef } from "react";

interface RedditEmbedProps {
  url: string;
}

/**
 * Component to embed a Reddit post using Reddit's official widget
 * Loads Reddit's widgets.js script and renders the post
 */
export default function RedditEmbed({ url }: RedditEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    // Load Reddit widgets script if not already loaded
    // Reddit attaches to window.rembed
    if (!(window as any).rembed && !loadedRef.current) {
      const script = document.createElement('script');
      script.src = 'https://embed.reddit.com/widgets.js';
      script.async = true;
      script.charset = 'utf-8';
      document.body.appendChild(script);
      loadedRef.current = true;
    } else {
      // If script is already loaded, we might need to trigger a re-render of widgets
      // Reddit's script usually auto-scans on load, but for dynamic content we might need to re-trigger.
      // However, Reddit's widget.js doesn't expose a clear public API like Twitter's `twttr.widgets.load()`.
      // It usually relies on the script execution or DOM mutation observers.
      // Re-inserting the script is a common hack if it doesn't pick up new elements.
      if ((window as any).rembed) {
         // Try to re-run the scan if available, otherwise re-injecting script might be needed
         // But usually just having the class 'reddit-card' is enough if the script is running.
         // If it fails to render on navigation, we might need to reload the script.
      }
    }
  }, [url]);

  return (
    <div ref={containerRef} className="reddit-embed-container w-full">
      <blockquote className="reddit-card" data-card-created={Date.now()} style={{ width: '100%' }}>
        <a href={url}>View on Reddit</a>
      </blockquote>
    </div>
  );
}
