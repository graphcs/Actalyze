import React from "react";

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" ");

type ButtonVariant = "default" | "ghost" | "outline" | "secondary";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}

export const Button = ({
  className = "",
  variant = "default",
  size = "md",
  children,
  onClick,
  type = "button",
  disabled = false
}: ButtonProps) => {
  const base = "inline-flex items-center gap-2 rounded-2xl font-medium transition active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = {
    sm: "text-sm px-3 py-2",
    md: "text-sm px-4 py-2.5",
    lg: "text-base px-5 py-3",
  };
  const variants = {
    default: "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
    ghost: "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800",
    outline: "border border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800",
    secondary: "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(base, sizes[size], variants[variant], className)}
    >
      {children}
    </button>
  );
};
