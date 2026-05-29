"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className={cn("flex items-center justify-center gap-1", className)}>
      <Button
        variant="ghost"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="size-4" />
      </Button>
      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
        const start = Math.max(1, Math.min(page - 2, totalPages - 4));
        const p = start + i;
        if (p > totalPages) return null;
        return (
          <Button
            key={p}
            variant={p === page ? "default" : "ghost"}
            size="sm"
            className="min-w-8"
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        );
      })}
      <Button
        variant="ghost"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
