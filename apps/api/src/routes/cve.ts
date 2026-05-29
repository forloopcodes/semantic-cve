import type { FastifyInstance } from 'fastify';
import { getCveById, getSimilarCves, getLatestCves } from '@semantic-cve/db';

export const cveRoutes = async (app: FastifyInstance) => {
  app.get<{ Params: { id: string } }>('/cves/:id', async (req, reply) => {
    const cve = getCveById(req.params.id);
    if (!cve) return reply.status(404).send({ error: 'CVE not found' });
    return cve;
  });

  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>('/cves/:id/similar', async (req) => {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const similar = await getSimilarCves(req.params.id, limit);
    return { results: similar };
  });

  app.get('/cves', async (req) => {
    const { limit, offset, days } = req.query as Record<string, string | undefined>;
    const n = limit ? parseInt(limit, 10) : 50;
    const o = offset ? parseInt(offset, 10) : 0;
    const d = days ? parseInt(days, 10) : undefined;
    const cves = d ? getLatestCves(d) : [];
    return { results: cves.slice(o, o + n), total: cves.length };
  });
};
