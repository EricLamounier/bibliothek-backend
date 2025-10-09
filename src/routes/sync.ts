import { FastifyInstance } from 'fastify';
import { syncStatus } from '../controllers/sync';

async function syncRoutes(fastify: FastifyInstance) {
  fastify.get('/', syncStatus);
}

export default syncRoutes;