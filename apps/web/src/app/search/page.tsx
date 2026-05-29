"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CveCard } from "@/components/cve-card";
import { Pagination } from "@/components/ui/pagination";
import { searchCves } from "@/lib/api";

interface CveResult {
  cve: {
    cveId: string;
    description: string;
    cvssScore: number | null;
    cvssSeverity: string | null;
    publishedDate: string | null;
    vendor: string | null;
    product: string | null;
  };
  score: number;
  matchType: string;
}

const PER_PAGE = 15;

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [results, setResults] = useState<CveResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("hybrid");
  const [page, setPage] = useState(1);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      setLoading(true);
      try {
        const data = await searchCves({ query: q, mode, limit: 50 });
        setResults(data.results as CveResult[]);
      } catch {
        setResults([]);
      }
      setLoading(false);
    },
    [mode]
  );

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setQuery(q);
      doSearch(q);
    }
  }, [searchParams, doSearch]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      doSearch(query.trim());
    }
  };

  const totalPages = Math.ceil(results.length / PER_PAGE);
  const paginatedResults = results.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
          <ArrowLeft className="size-4" />
        </Button>
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vulnerabilities..."
              className="h-10 pl-9 text-sm rounded-xl"
            />
          </div>
        </form>
        <Select value={mode} onValueChange={(v) => v && setMode(v)}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hybrid">Hybrid</SelectItem>
            <SelectItem value="semantic">Semantic</SelectItem>
            <SelectItem value="fulltext">Full Text</SelectItem>
            <SelectItem value="regex">Regex</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} size="sm">
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : results.length > 0 ? (
        <>
          <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{results.length} result{results.length !== 1 ? "s" : ""}</span>
            <Separator orientation="vertical" className="h-3" />
            <span className="capitalize">{mode}</span>
          </div>
          <div className="space-y-2.5">
            {paginatedResults.map((r, i) => (
              <CveCard
                key={`${r.cve.cveId}-${i}`}
                cve={r.cve}
                score={r.score}
                matchType={r.matchType}
              />
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            className="mt-6"
          />
        </>
      ) : query ? (
        <div className="flex flex-col items-center gap-3 py-24">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Search className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No results found for &ldquo;{query}&rdquo;
          </p>
          <p className="text-xs text-muted-foreground/50">
            Try a different search mode or rephrase your query
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-24">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Search className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Enter a query to search</p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} size="sm">
                <CardContent className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
