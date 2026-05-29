"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const examples = [
  "Windows privilege escalation using symbolic links",
  "Apache authentication bypass in reverse proxy",
  "Python deserialization remote code execution",
  "Recent auth bypass vulnerabilities with public exploits",
];

export default function HomePage() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim())
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--accent)_0%,_transparent_60%)] opacity-[0.03]" />

      <div className="flex flex-col items-center gap-2 mb-8">
        <h1 className="text-4xl font-heading tracking-tight sm:text-5xl">
          Semantic CVE
        </h1>
        <p className="max-w-lg text-center text-sm text-muted-foreground">
          Describe a vulnerability in plain English. Find every relevant CVE
          across 350k+ records using semantic search.
        </p>
      </div>

      <form onSubmit={handleSearch} className="w-full max-w-xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe a vulnerability..."
            className="h-13 pl-11 pr-4 text-base rounded-xl"
          />
        </div>
      </form>

      <Card size="sm" className="mt-8 w-full max-w-xl border-dashed" id="examples">
        <CardContent className="flex flex-wrap gap-2">
          {examples.map((ex) => (
            <Button
              key={ex}
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery(ex);
                router.push(`/search?q=${encodeURIComponent(ex)}`);
              }}
              className="group text-xs"
            >
              {ex}
              <ArrowRight className="ml-1 size-3 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="mt-12 flex items-center gap-6 text-xs text-muted-foreground/50">
        <span>semantic search</span>
        <Separator orientation="vertical" className="h-3" />
        <span>full-text search</span>
        <Separator orientation="vertical" className="h-3" />
        <span>regex search</span>
        <Separator orientation="vertical" className="h-3" />
        <span>hybrid search</span>
      </div>
    </div>
  );
}
