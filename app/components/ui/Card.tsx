import React from "react";

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" ");

export const Card = ({
  className = "",
  children,
  onClick
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) => (
  <div
    className={cn("bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm", className)}
    onClick={onClick}
  >
    {children}
  </div>
);

export const CardHeader = ({ className = "", children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("p-5 border-b border-zinc-100 dark:border-zinc-800", className)}>{children}</div>
);

export const CardContent = ({ className = "", children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("p-5", className)}>{children}</div>
);
