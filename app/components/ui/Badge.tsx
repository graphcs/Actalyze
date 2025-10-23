import React from "react";

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" ");

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export const Badge = ({ children, className = "" }: BadgeProps) => (
  <span className={cn("inline-flex items-center gap-1 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-2.5 py-1 text-xs font-medium", className)}>
    {children}
  </span>
);
