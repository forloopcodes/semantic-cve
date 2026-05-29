import { API_BASE } from './utils';

interface FetchOptions { query: string; mode?: string; limit?: number; offset?: number; }

interface ApiError { error: string; status: number; }

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw { error: (body as ApiError).error ?? res.statusText, status: res.status };
  }
  return res.json() as Promise<T>;
}

const camelize = (r: Record<string, unknown>): Record<string, unknown> => ({
  cveId: r.cve_id,
  description: r.description,
  cweId: r.cwe_id,
  vendor: r.vendor,
  product: r.product,
  affectedVersions: r.affected_versions,
  cvssScore: r.cvss_score,
  cvssSeverity: r.cvss_severity,
  publishedDate: r.published_date,
  updatedDate: r.updated_date,
  jsonData: r.json_data,
  references: r.references,
});

const camelizeResult = (r: Record<string, unknown>) => ({
  ...r,
  cve: r.cve ? camelize(r.cve as Record<string, unknown>) : r.cve,
});

export const searchCves = async ({ query, mode = 'hybrid', limit = 20, offset = 0 }: FetchOptions) => {
  const params = new URLSearchParams({ query, mode, limit: String(limit), offset: String(offset) });
  const data = await fetchJson<{ results: Record<string, unknown>[]; total: number }>(
    `${API_BASE}/api/search?${params}`
  );
  return { ...data, results: data.results.map(camelizeResult) };
};

export const getCve = async (id: string) => {
  const data = await fetchJson<Record<string, unknown>>(
    `${API_BASE}/api/cves/${encodeURIComponent(id)}`
  );
  return camelize(data);
};

export const getSimilarCves = async (id: string, limit = 10) => {
  const data = await fetchJson<{ results: Record<string, unknown>[] }>(
    `${API_BASE}/api/cves/${encodeURIComponent(id)}/similar?limit=${limit}`
  );
  return { ...data, results: data.results.map(camelizeResult) };
};

export const getLatestCves = async (days = 7, limit = 20) => {
  const data = await fetchJson<{ results: Record<string, unknown>[]; total: number }>(
    `${API_BASE}/api/cves?days=${days}&limit=${limit}`
  );
  return { ...data, results: data.results.map(camelize) };
};
