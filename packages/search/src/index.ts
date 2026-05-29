import { searchFts, searchRegex, searchSemantic, getCvesByIds } from '@semantic-cve/db';
import { embed } from '@semantic-cve/embeddings';
import type { SearchResult, SearchQuery } from '@semantic-cve/shared';
import { HYBRID_WEIGHTS } from '@semantic-cve/shared';
import { arrToVec } from '@semantic-cve/vector-store';

const embedCache = new Map<string, Float32Array>();

const getQueryVec = async (query: string): Promise<Float32Array> => {
  const cached = embedCache.get(query);
  if (cached) return cached;
  const vec = arrToVec(await embed(query));
  embedCache.set(query, vec);
  return vec;
};

export const searchBySemantic = async (query: string, limit = 20): Promise<SearchResult[]> => {
  const vec = await getQueryVec(query);
  const scored = searchSemantic(vec, limit);
  const cves = getCvesByIds(scored.map(s => s.id));
  const cveMap = new Map(cves.map(c => [c.cve_id, c]));
  return scored.map(s => ({ cve: cveMap.get(s.id)!, score: s.score, matchType: 'semantic' as const })).filter(r => r.cve);
};

export const searchByFts = (query: string, limit = 20): SearchResult[] => searchFts(query, limit);

export const searchByRegex = (query: string, limit = 20): SearchResult[] => searchRegex(query, limit);

export const searchHybrid = async (query: string, limit = 20): Promise<SearchResult[]> => {
  const [semantic, fts] = await Promise.all([
    searchBySemantic(query, limit),
    searchByFts(query, limit),
  ]);
  const combined = new Map<string, SearchResult>();
  for (const r of semantic) {
    combined.set(r.cve.cve_id as string, { ...r, score: r.score * HYBRID_WEIGHTS.semantic, matchType: 'hybrid' });
  }
  for (const r of fts) {
    const id = r.cve.cve_id as string;
    const existing = combined.get(id);
    if (existing) existing.score += r.score * HYBRID_WEIGHTS.fts;
    else combined.set(id, { ...r, score: r.score * HYBRID_WEIGHTS.fts, matchType: 'hybrid' });
  }
  return [...combined.values()].sort((a, b) => b.score - a.score).slice(0, limit);
};

export const search = async (sq: SearchQuery): Promise<SearchResult[]> => {
  const limit = sq.limit ?? 20;
  switch (sq.mode) {
    case 'semantic': return searchBySemantic(sq.query, limit);
    case 'fulltext': return searchByFts(sq.query, limit);
    case 'regex': return searchByRegex(sq.query, limit);
    case 'hybrid': return searchHybrid(sq.query, limit);
  }
};
