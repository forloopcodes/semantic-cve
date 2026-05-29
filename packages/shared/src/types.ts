export interface CveRecord {
  cve_id: string;
  description: string;
  cwe_id: string | null;
  vendor: string | null;
  product: string | null;
  affected_versions: string | null;
  cvss_score: number | null;
  cvss_severity: string | null;
  published_date: string | null;
  updated_date: string | null;
  json_data: string | null;
}

export interface SearchResult {
  cve: Record<string, unknown>;
  score: number;
  matchType: 'semantic' | 'fulltext' | 'regex' | 'hybrid';
}

export interface SearchQuery {
  query: string;
  mode: 'semantic' | 'fulltext' | 'regex' | 'hybrid';
  limit?: number;
  offset?: number;
}

export const EMBEDDING_DIMENSION = 1024;
export const EMBEDDING_MODEL = 'qwen3-embedding:0.6b';
export const HYBRID_WEIGHTS = { semantic: 0.7, fts: 0.3 } as const;
export const CVE_CACHE_DIR = 'cve-cache';
export const CVE_LIST_REPO = 'https://github.com/CVEProject/cvelistV5.git';
