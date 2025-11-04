"use client";

import { useEffect, useRef } from "react";

interface TweetEmbedProps {
  tweetId: string;
  username: string;
}

/**
 * Component to embed a tweet using Twitter's official widget
 * Loads Twitter's widget.js script and renders the tweet
 */
export default function TweetEmbed({ tweetId, username }: TweetEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    // Load Twitter widgets script if not already loaded
    if (!(window as Window & { twttr?: { widgets?: { load?: () => void } } }).twttr && !loadedRef.current) {
      const script = document.createElement('script');
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.charset = 'utf-8';
      document.body.appendChild(script);
      loadedRef.current = true;

      script.onload = () => {
        if (containerRef.current) {
          (window as Window & { twttr?: { widgets?: { load?: () => void } } }).twttr?.widgets?.load?.();
        }
      };
    } else {
      // Script already loaded, just re-render widgets
      const twttr = (window as Window & { twttr?: { widgets?: { load?: () => void } } }).twttr;
      if (twttr?.widgets?.load) {
        twttr.widgets.load();
      }
    }
  }, [tweetId]);

  const tweetUrl = `https://twitter.com/${username}/status/${tweetId}`;

  return (
    <div ref={containerRef} className="tweet-embed-container">
      <blockquote className="twitter-tweet" data-conversation="none" data-theme="light">
        <a href={tweetUrl}>Tweet by @{username}</a>
      </blockquote>
    </div>
  );
}
