import type { FastifyInstance } from 'fastify';

export const healthRoutes = async (app: FastifyInstance) => {
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
};
