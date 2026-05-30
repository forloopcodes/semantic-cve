import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDate = (d: Date | string | null) => {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").trim();
