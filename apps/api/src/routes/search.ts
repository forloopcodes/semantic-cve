import type { FastifyInstance } from 'fastify';
import { search } from '@semantic-cve/search';

interface SearchQueryString {
  query: string;
  mode?: 'semantic' | 'fulltext' | 'regex' | 'hybrid';
  limit?: string;
  offset?: string;
  cvssMin?: string;
  cvssMax?: string;
  cwe?: string;
  vendor?: string;
  product?: string;
}

export const searchRoutes = async (app: FastifyInstance) => {
  app.get<{ Querystring: SearchQueryString }>('/search', async (req, reply) => {
    const { query, mode = 'hybrid', limit, offset, cvssMin, cvssMax, cwe, vendor, product } = req.query;
    if (!query) return reply.status(400).send({ error: 'query required' });
    const results = await search({
      query,
      mode,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return { results, total: results.length };
  });
};
