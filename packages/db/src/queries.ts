import { getDb } from './client.js';
import { vecToBuf, bufToVec, topKFromBuf } from '@semantic-cve/vector-store';
import type { SearchResult } from '@semantic-cve/shared';

export const upsertCve = (data: {
  cveId: string; description: string; cweId?: string;
  vendor?: string; product?: string; affectedVersions?: string;
  cvssScore?: number; cvssSeverity?: string;
  publishedDate?: string; updatedDate?: string;
}) => {
  const d = getDb();
  const stmt = d.prepare(`INSERT INTO cves (cve_id, description, cwe_id, vendor, product, affected_versions, cvss_score, cvss_severity, published_date, updated_date)
    VALUES (@cveId, @description, @cweId, @vendor, @product, @affectedVersions, @cvssScore, @cvssSeverity, @publishedDate, @updatedDate)
    ON CONFLICT(cve_id) DO UPDATE SET
      description=excluded.description, cwe_id=excluded.cwe_id, vendor=excluded.vendor, product=excluded.product,
      affected_versions=excluded.affected_versions, cvss_score=excluded.cvss_score, cvss_severity=excluded.cvss_severity,
      published_date=excluded.published_date, updated_date=excluded.updated_date,
      updated_at=datetime('now')`);
  stmt.run({
    cveId: data.cveId, description: data.description, cweId: data.cweId ?? null,
    vendor: data.vendor ?? null, product: data.product ?? null,
    affectedVersions: data.affectedVersions ?? null,
    cvssScore: data.cvssScore ?? null, cvssSeverity: data.cvssSeverity ?? null,
    publishedDate: data.publishedDate ?? null, updatedDate: data.updatedDate ?? null,
  });
};

export const getCveById = (cveId: string) => {
  const d = getDb();
  return d.prepare(`SELECT * FROM cves WHERE cve_id = ?`).get(cveId) as Record<string, unknown> | undefined;
};

export const getCvesByIds = (ids: string[]) => {
  if (!ids.length) return [];
  const d = getDb();
  const placeholders = ids.map(() => '?').join(',');
  return d.prepare(`SELECT * FROM cves WHERE cve_id IN (${placeholders})`).all(...ids) as Record<string, unknown>[];
};

export const getLatestCves = (days: number) => {
  const d = getDb();
  return d.prepare(`SELECT * FROM cves WHERE published_date >= date('now', ?) ORDER BY published_date DESC LIMIT 100`)
    .all(`-${days} days`) as Record<string, unknown>[];
};

export const countCves = () => {
  const d = getDb();
  const row = d.prepare(`SELECT COUNT(*) as cnt FROM cves`).get() as { cnt: number };
  return row.cnt;
};

export const searchFts = (query: string, limit = 20): SearchResult[] => {
  const d = getDb();
  const rows = d.prepare(`SELECT cve_id, rank FROM cve_fts WHERE cve_fts MATCH ? ORDER BY rank LIMIT ?`)
    .all(query, limit) as { cve_id: string; rank: number }[];
  if (!rows.length) return [];
  const cves = getCvesByIds(rows.map(r => r.cve_id));
  const cveMap = new Map(cves.map(c => [c.cve_id, c]));
  return rows.map(r => ({ cve: cveMap.get(r.cve_id) as Record<string, unknown>, score: -r.rank, matchType: 'fulltext' as const }));
};

export const searchRegex = (pattern: string, limit = 20): SearchResult[] => {
  const d = getDb();
  try {
    const rows = d.prepare(`SELECT cve_id FROM cves WHERE description REGEXP ? OR vendor REGEXP ? OR product REGEXP ? LIMIT ?`)
      .all(pattern, pattern, pattern, limit) as { cve_id: string }[];
    const cves = getCvesByIds(rows.map(r => r.cve_id));
    return cves.map(c => ({ cve: c, score: 1, matchType: 'regex' as const }));
  } catch { return []; }
};

export const searchByVendorProduct = (vendor?: string, product?: string, limit = 20) => {
  const d = getDb();
  let sql = `SELECT * FROM cves WHERE 1=1`;
  const params: unknown[] = [];
  if (vendor) { sql += ` AND vendor LIKE ?`; params.push(`%${vendor}%`); }
  if (product) { sql += ` AND product LIKE ?`; params.push(`%${product}%`); }
  sql += ` LIMIT ?`; params.push(limit);
  return d.prepare(sql).all(...params) as Record<string, unknown>[];
};

export const searchByCwe = (cwe: string, limit = 20) => {
  const d = getDb();
  return d.prepare(`SELECT * FROM cves WHERE cwe_id = ? LIMIT ?`).all(cwe, limit) as Record<string, unknown>[];
};

const EMBEDDING_DIM = 1024;
let vectorCache: { id: string; buf: Buffer }[] | null = null;
let cacheTs = 0;

const loadVectors = (): { id: string; buf: Buffer }[] => {
  const now = Date.now();
  if (vectorCache && now - cacheTs < 60000) return vectorCache;
  const d = getDb();
  const rows = d.prepare(`SELECT cve_id, vector FROM embeddings WHERE vector IS NOT NULL`).all() as { cve_id: string; vector: Buffer }[];
  vectorCache = rows.map(r => ({ id: r.cve_id, buf: r.vector }));
  cacheTs = now;
  return vectorCache;
};

export const searchSemantic = (queryVec: Float32Array, limit = 20): { id: string; score: number }[] => {
  const vecs = loadVectors();
  return topKFromBuf(vecs, queryVec, limit, EMBEDDING_DIM);
};

export const getSimilarCves = (cveId: string, limit = 10): SearchResult[] => {
  const d = getDb();
  const row = d.prepare(`SELECT vector FROM embeddings WHERE cve_id = ?`).get(cveId) as { vector: Buffer } | undefined;
  if (!row?.vector) return [];
  const queryVec = bufToVec(row.vector);
  const vecs = loadVectors().filter(v => v.id !== cveId);
  const scored = topKFromBuf(vecs, queryVec, limit, EMBEDDING_DIM);
  const cves = getCvesByIds(scored.map(s => s.id));
  const cveMap = new Map(cves.map(c => [c.cve_id, c]));
  return scored.map(s => ({ cve: cveMap.get(s.id)!, score: s.score, matchType: 'semantic' as const }));
};

export const upsertEmbedding = (cveId: string, vector: Float32Array) => {
  const d = getDb();
  d.prepare(`INSERT INTO embeddings (cve_id, vector, model) VALUES (?, ?, 'qwen3-embedding:0.6b')
    ON CONFLICT(cve_id) DO UPDATE SET vector=excluded.vector, model=excluded.model, created_at=datetime('now')`)
    .run(cveId, vecToBuf(vector));
};

export const getHash = (cveId: string): string | undefined => {
  const d = getDb();
  const row = d.prepare(`SELECT hash FROM hashes WHERE cve_id = ?`).get(cveId) as { hash: string } | undefined;
  return row?.hash;
};

export const upsertHash = (cveId: string, hash: string) => {
  const d = getDb();
  d.prepare(`INSERT INTO hashes (cve_id, hash) VALUES (?, ?) ON CONFLICT(cve_id) DO UPDATE SET hash=excluded.hash, updated_at=datetime('now')`).run(cveId, hash);
};
