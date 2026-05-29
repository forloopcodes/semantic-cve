import Fastify from 'fastify';
import cors from '@fastify/cors';
import { searchRoutes } from './routes/search.js';
import { cveRoutes } from './routes/cve.js';
import { healthRoutes } from './routes/health.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(healthRoutes, { prefix: '/api' });
await app.register(searchRoutes, { prefix: '/api' });
await app.register(cveRoutes, { prefix: '/api' });

const PORT = parseInt(process.env.API_PORT ?? '4000', 10);
const HOST = process.env.API_HOST ?? '0.0.0.0';

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`API running on ${HOST}:${PORT}`);
} catch (e) {
  app.log.error(e);
  process.exit(1);
}
