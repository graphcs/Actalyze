/**
 * Utility functions
 */

import { type ClassValue, clsx } from "clsx";

/**
 * Merge Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
