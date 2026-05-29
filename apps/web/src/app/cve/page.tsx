// CVE detail page with query-param routing for static export
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { ArrowLeft, ExternalLink, AlertTriangle, Bug, Calendar, Tag, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CveCard } from "@/components/cve-card";
import { getCve, getSimilarCves } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface CveDetail {
  cveId: string;
  description: string;
  cvssScore: number | null;
  cvssSeverity: string | null;
  cweId: string | null;
  vendor: string | null;
  product: string | null;
  affectedVersions: string | null;
  publishedDate: string | null;
  updatedDate: string | null;
  references: { url: string; source: string | null; tags: string[] }[];
  jsonData: unknown;
}

const severityColor: Record<string, string> = {
  critical: "text-destructive",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-emerald-400",
};

function MetaCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="truncate text-sm font-medium text-foreground">
            {value}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CveContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const router = useRouter();
  const [cve, setCve] = useState<CveDetail | null>(null);
  const [similar, setSimilar] = useState<{ cve: { cveId: string; description: string; cvssSeverity: string | null; cvssScore: number | null; vendor: string | null; product: string | null; publishedDate: string | null }; score: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([getCve(id), getSimilarCves(id)])
      .then(([cveData, similarData]) => {
        setCve(cveData as unknown as CveDetail);
        setSimilar((similarData as { results: typeof similar }).results ?? []);
      })
      .catch(() => setCve(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="mb-8 h-5 w-16" />
        <div className="mb-8 space-y-3">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-4 w-64" />
      </div>
    );

  if (!cve)
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <AlertTriangle className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">CVE not found</p>
        <Button variant="link" onClick={() => router.push("/")}>
          Back to search
        </Button>
      </div>
    );

  const infoCards = [
    ...(cve.cweId ? [{ icon: Tag, label: "CWE", value: cve.cweId }] : []),
    ...(cve.vendor ? [{ icon: Box, label: "Vendor / Product", value: `${cve.vendor}${cve.product ? ` / ${cve.product}` : ""}` }] : []),
    ...(cve.publishedDate ? [{ icon: Calendar, label: "Published", value: formatDate(cve.publishedDate) }] : []),
    ...(cve.updatedDate ? [{ icon: Calendar, label: "Updated", value: formatDate(cve.updatedDate) }] : []),
    ...(cve.affectedVersions ? [{ icon: Bug, label: "Affected Versions", value: cve.affectedVersions }] : []),
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="mb-6"
      >
        <ArrowLeft className="size-4" /> Back
      </Button>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="mb-1 font-heading text-2xl tracking-tight text-foreground">
            {cve.cveId}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {cve.description}
          </p>
        </div>
        {cve.cvssScore !== null && (
          <div className="flex flex-col items-center shrink-0 min-w-20">
            <span className={`text-3xl font-heading tabular-nums tracking-tight ${severityColor[cve.cvssSeverity?.toLowerCase() ?? ""] ?? "text-foreground"}`}>
              {cve.cvssScore.toFixed(1)}
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              {cve.cvssSeverity ?? "N/A"}
            </span>
          </div>
        )}
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        {infoCards.map((c, i) => (
          <MetaCard key={i} icon={c.icon} label={c.label} value={c.value} />
        ))}
      </div>

      {similar.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-foreground">
            Similar CVEs
          </h2>
          <div className="space-y-2.5">
            {similar.slice(0, 5).map((s, i) => (
              <CveCard key={i} cve={s.cve} score={s.score} variant="compact" />
            ))}
          </div>
        </div>
      )}

      <Separator className="mb-6" />

      <Tabs defaultValue="json" className="mb-8">
        <TabsList className="mb-6">
          {cve.references && cve.references.length > 0 && (
            <TabsTrigger value="references">
              References ({cve.references.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="json">Raw JSON</TabsTrigger>
        </TabsList>

        {cve.references && cve.references.length > 0 && (
          <TabsContent value="references">
            <div className="space-y-1.5">
              {cve.references.map((ref, i) => (
                <a
                  key={i}
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-lg border border-border/40 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground hover:bg-muted/30"
                >
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground/50" />
                  <span className="truncate">{ref.url}</span>
                  {ref.source && (
                    <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
                      {ref.source}
                    </Badge>
                  )}
                </a>
              ))}
            </div>
          </TabsContent>
        )}

        <TabsContent value="json">
          <div className="overflow-auto max-h-[60vh] rounded-xl border border-border/50 bg-card p-4">
            <pre className="text-xs leading-relaxed text-muted-foreground">
              {JSON.stringify(cve.jsonData ?? cve, null, 2)}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CvePage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="mb-8 h-5 w-16" />
        <div className="mb-8 space-y-3">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-4 w-64" />
      </div>
    }>
      <CveContent />
    </Suspense>
  );
}
