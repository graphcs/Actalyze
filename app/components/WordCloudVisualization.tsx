/**
 * Word Cloud Visualization Component
 * Interactive word cloud with D3 and React
 */

"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import cloud from "d3-cloud";
import type { WordCloudWord } from "@/types/wordcloud";
import { Skeleton } from "./ui/Skeleton";

interface WordCloudVisualizationProps {
  words: WordCloudWord[];
  onWordClick: (word: string) => void;
  loading?: boolean;
}

interface D3Word {
  text: string;
  size: number;
  sentiment: number;
  x?: number;
  y?: number;
  rotate?: number;
}

/**
 * Get color based on sentiment score
 * Positive: green shades
 * Negative: red shades
 * Neutral: blue/gray shades
 */
function getSentimentColor(sentiment: number): string {
  if (sentiment > 0.1) {
    // Positive: green shades
    const intensity = Math.min(sentiment * 100, 100);
    return `hsl(142, ${50 + intensity / 2}%, ${40 - intensity / 4}%)`;
  } else if (sentiment < -0.1) {
    // Negative: red shades
    const intensity = Math.min(Math.abs(sentiment) * 100, 100);
    return `hsl(0, ${50 + intensity / 2}%, ${45 - intensity / 4}%)`;
  } else {
    // Neutral: blue-gray shades
    return `hsl(215, 20%, 45%)`;
  }
}

export default function WordCloudVisualization({
  words,
  onWordClick,
  loading = false,
}: WordCloudVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: width,
          height: Math.max(500, Math.min(600, width * 0.6)),
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Generate word cloud
  useEffect(() => {
    if (!words.length || !svgRef.current || loading) return;

    // Clear previous render
    d3.select(svgRef.current as SVGSVGElement)
      .selectAll("*")
      .remove();

    // Scale font sizes - use simple linear scaling
    const maxValue = Math.max(...words.map((w) => w.value));
    const minValue = Math.min(...words.map((w) => w.value));

    // Simple linear scale for font sizes
    const fontScale = (value: number) => {
      const normalized = (value - minValue) / (maxValue - minValue || 1);
      return 12 + normalized * 68; // Range from 12 to 80
    };

    // Prepare words for d3-cloud (limit to top 150 for performance)
    const topWords = words.slice(0, 150);
    const d3Words: D3Word[] = topWords.map((w) => ({
      text: w.text,
      size: fontScale(w.value),
      sentiment: w.sentiment,
    }));

    // Create word cloud layout
    const layout = cloud<D3Word>()
      .size([dimensions.width, dimensions.height])
      .words(d3Words)
      .padding(5)
      .rotate(() => (Math.random() > 0.5 ? 0 : 90))
      .font("Inter, sans-serif")
      .fontSize((d) => d.size)
      .on("end", draw);

    layout.start();

    function draw(cloudWords: D3Word[]) {
      const svg = d3
        .select(svgRef.current as SVGSVGElement)
        .attr("width", dimensions.width)
        .attr("height", dimensions.height)
        .attr("viewBox", `0 0 ${dimensions.width} ${dimensions.height}`);

      const g = svg
        .append("g")
        .attr(
          "transform",
          `translate(${dimensions.width / 2},${dimensions.height / 2})`
        );

      const text = g
        .selectAll("text")
        .data(cloudWords)
        .enter()
        .append("text")
        .style("font-size", (d) => `${d.size}px`)
        .style("font-family", "Inter, sans-serif")
        .style("font-weight", "600")
        .style("fill", (d) => getSentimentColor(d.sentiment))
        .style("cursor", "pointer")
        .style("transition", "all 0.2s ease")
        .attr("text-anchor", "middle")
        .attr("transform", (d) => `translate(${d.x},${d.y})rotate(${d.rotate})`)
        .text((d) => d.text)
        .on("mouseenter", function (this: SVGTextElement) {
          const element = d3.select(this);
          const data = element.datum() as D3Word;
          element
            .style("font-weight", "700")
            .style("opacity", "0.8")
            .transition()
            .duration(200)
            .style("font-size", `${data.size * 1.1}px`);
        })
        .on("mouseleave", function (this: SVGTextElement) {
          const element = d3.select(this);
          const data = element.datum() as D3Word;
          element
            .style("font-weight", "600")
            .style("opacity", "1")
            .transition()
            .duration(200)
            .style("font-size", `${data.size}px`);
        })
        .on("click", function (this: SVGTextElement) {
          const element = d3.select(this);
          const data = element.datum() as D3Word;
          onWordClick(data.text);
        });

      // Add hover tooltip
      text.append("title").text((d) => {
        const wordData = words.find((w) => w.text === d.text);
        const count = wordData ? wordData.value : 0;
        const sentiment =
          d.sentiment > 0.1
            ? "Positive"
            : d.sentiment < -0.1
            ? "Negative"
            : "Neutral";
        return `${d.text}\nFrequency: ${count}\nSentiment: ${sentiment}`;
      });
    }
  }, [words, dimensions, onWordClick, loading]);

  if (loading) {
    return (
      <div ref={containerRef} className="w-full">
        <div className="relative w-full h-[500px] flex items-center justify-center bg-gradient-to-br from-white via-zinc-50 to-blue-50/30 dark:from-zinc-900 dark:via-zinc-900 dark:to-blue-950/30 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 dark:from-blue-500/10 dark:to-purple-500/10" />
          <div className="absolute inset-0 flex items-center justify-center p-8 z-10">
            <div className="text-center space-y-6 w-full max-w-2xl">
              <div className="flex justify-center gap-3 flex-wrap">
                <Skeleton className="h-8 w-24 rounded-xl" />
                <Skeleton className="h-12 w-32 rounded-xl" />
                <Skeleton className="h-6 w-20 rounded-xl" />
                <Skeleton className="h-10 w-28 rounded-xl" />
              </div>
              <div className="flex justify-center gap-3 flex-wrap">
                <Skeleton className="h-10 w-28 rounded-xl" />
                <Skeleton className="h-6 w-16 rounded-xl" />
                <Skeleton className="h-8 w-24 rounded-xl" />
                <Skeleton className="h-12 w-36 rounded-xl" />
                <Skeleton className="h-6 w-18 rounded-xl" />
              </div>
              <div className="flex justify-center gap-3 flex-wrap">
                <Skeleton className="h-6 w-20 rounded-xl" />
                <Skeleton className="h-10 w-28 rounded-xl" />
                <Skeleton className="h-8 w-24 rounded-xl" />
                <Skeleton className="h-12 w-32 rounded-xl" />
              </div>
              <div className="flex justify-center gap-3 flex-wrap">
                <Skeleton className="h-12 w-32 rounded-xl" />
                <Skeleton className="h-6 w-16 rounded-xl" />
                <Skeleton className="h-8 w-28 rounded-xl" />
                <Skeleton className="h-10 w-24 rounded-xl" />
              </div>
            </div>
          </div>
          <div className="absolute bottom-6 text-sm text-zinc-600 dark:text-zinc-400 font-medium z-10 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            Generating word cloud...
          </div>
        </div>
      </div>
    );
  }

  if (!words.length) {
    return (
      <div ref={containerRef} className="w-full">
        <div className="relative w-full h-[500px] flex items-center justify-center bg-gradient-to-br from-white via-zinc-50 to-zinc-100/50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-500/5 via-transparent to-zinc-500/5" />
          <div className="text-center text-zinc-500 dark:text-zinc-400 z-10 space-y-3">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-zinc-400 dark:text-zinc-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
            </div>
            <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
              No words to display
            </p>
            <p className="text-sm max-w-sm mx-auto">
              Try adjusting your filters or search for a different topic
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <div className="relative w-full bg-gradient-to-br from-white via-zinc-50/50 to-blue-50/20 dark:from-zinc-900 dark:via-zinc-900/90 dark:to-blue-950/20 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 via-purple-500/3 to-transparent dark:from-blue-500/5 dark:via-purple-500/5" />
        <svg
          ref={svgRef}
          className="w-full h-auto relative z-10"
          style={{ minHeight: "500px" }}
        />

        {/* Legend */}
        <div className="absolute bottom-6 right-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-xl p-4 border-2 border-zinc-200 dark:border-zinc-800 text-xs shadow-xl z-20">
          <div className="font-bold mb-3 text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <svg
                className="w-3 h-3 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                />
              </svg>
            </div>
            Sentiment
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-500 to-green-600 shadow-sm"></div>
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                Positive
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-zinc-400 to-zinc-500 shadow-sm"></div>
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                Neutral
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-sm"></div>
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                Negative
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
            <p className="text-[10px] text-zinc-500 dark:text-zinc-500">
              Click any word for details
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
