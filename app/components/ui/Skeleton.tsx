/**
 * Skeleton Loading Component
 * Provides visual feedback during data loading
 */

import { cn } from "@/src/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800",
        className
      )}
    />
  );
}

/**
 * Skeleton variants for common use cases
 */

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex gap-2 mt-4">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 ? "w-4/5" : "w-full")}
        />
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function SkeletonWordCloud() {
  return (
    <div className="relative w-full h-96 flex items-center justify-center">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="flex justify-center gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-12 w-32" />
            <Skeleton className="h-6 w-20" />
          </div>
          <div className="flex justify-center gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-12 w-36" />
          </div>
          <div className="flex justify-center gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="flex justify-center gap-2">
            <Skeleton className="h-12 w-32" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
      </div>
    </div>
  );
}
