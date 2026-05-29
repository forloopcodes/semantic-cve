import { getCveById, getSimilarCves, getLatestCves, searchByVendorProduct, searchByCwe } from '@semantic-cve/db';
import { search } from '@semantic-cve/search';

interface McpRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface McpResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

const send = (msg: McpResponse) => process.stdout.write(JSON.stringify(msg) + '\n');

const handleRequest = async (req: McpRequest): Promise<McpResponse> => {
  const { id, method, params } = req;
  try {
    switch (method) {
      case 'initialize': {
        return {
          jsonrpc: '2.0', id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'semantic-cve', version: '1.0.0' },
          },
        };
      }
      case 'tools/list': {
        return {
          jsonrpc: '2.0', id,
          result: {
            tools: [
              {
                name: 'search_cves',
                description: 'Search CVEs by natural language query',
                inputSchema: {
                  type: 'object',
                  properties: {
                    query: { type: 'string', description: 'Natural language vulnerability description' },
                    mode: { type: 'string', enum: ['semantic', 'fulltext', 'regex', 'hybrid'], default: 'hybrid' },
                    limit: { type: 'number', default: 20 },
                  },
                  required: ['query'],
                },
              },
              {
                name: 'get_cve',
                description: 'Get CVE details by CVE ID',
                inputSchema: {
                  type: 'object',
                  properties: { id: { type: 'string', description: 'CVE ID like CVE-2025-1234' } },
                  required: ['id'],
                },
              },
              {
                name: 'related_cves',
                description: 'Find semantically similar CVEs',
                inputSchema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'Source CVE ID' },
                    limit: { type: 'number', default: 10 },
                  },
                  required: ['id'],
                },
              },
              {
                name: 'search_by_product',
                description: 'Search CVEs by vendor/product',
                inputSchema: {
                  type: 'object',
                  properties: {
                    vendor: { type: 'string' },
                    product: { type: 'string' },
                    limit: { type: 'number', default: 20 },
                  },
                },
              },
              {
                name: 'search_by_cwe',
                description: 'Search CVEs by CWE ID',
                inputSchema: {
                  type: 'object',
                  properties: { cwe: { type: 'string', description: 'CWE ID like CWE-79' }, limit: { type: 'number', default: 20 } },
                  required: ['cwe'],
                },
              },
              {
                name: 'latest_cves',
                description: 'Get latest CVEs from recent N days',
                inputSchema: {
                  type: 'object',
                  properties: { days: { type: 'number', default: 7 } },
                },
              },
            ],
          },
        };
      }
      case 'tools/call': {
        const { name, arguments: args } = params as { name: string; arguments: Record<string, unknown> };
        switch (name) {
          case 'search_cves': {
            const { query, mode = 'hybrid', limit = 20 } = args as { query: string; mode?: string; limit?: number };
            const results = await search({ query, mode: mode as 'semantic' | 'fulltext' | 'regex' | 'hybrid', limit: limit as number });
            return { jsonrpc: '2.0', id, result: { results } };
          }
          case 'get_cve': {
            const { id: cveId } = args as { id: string };
            const cve = getCveById(cveId);
            if (!cve) return { jsonrpc: '2.0', id, error: { code: -32000, message: 'CVE not found' } };
            return { jsonrpc: '2.0', id, result: cve };
          }
          case 'related_cves': {
            const { id: srcId, limit = 10 } = args as { id: string; limit?: number };
            const similar = await getSimilarCves(srcId, limit as number);
            return { jsonrpc: '2.0', id, result: { results: similar } };
          }
          case 'search_by_product': {
            const { vendor, product, limit = 20 } = args as { vendor?: string; product?: string; limit?: number };
            const cves = searchByVendorProduct(vendor, product, limit as number);
            return { jsonrpc: '2.0', id, result: { results: cves } };
          }
          case 'search_by_cwe': {
            const { cwe, limit = 20 } = args as { cwe: string; limit?: number };
            const cves = searchByCwe(cwe, limit as number);
            return { jsonrpc: '2.0', id, result: { results: cves } };
          }
          case 'latest_cves': {
            const { days = 7 } = args as { days?: number };
            const cves = await getLatestCves(days as number);
            return { jsonrpc: '2.0', id, result: { results: cves } };
          }
          default:
            return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${name}` } };
        }
      }
      default:
        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method: ${method}` } };
    }
  } catch (e) {
    return { jsonrpc: '2.0', id, error: { code: -32000, message: (e as Error).message } };
  }
};

const main = async () => {
  const rl = (await import('readline')).createInterface({ input: process.stdin });
  for await (const line of rl) {
    try {
      const req: McpRequest = JSON.parse(line);
      const res = await handleRequest(req);
      send(res);
    } catch { /* skip malformed */ }
  }
};

main();
