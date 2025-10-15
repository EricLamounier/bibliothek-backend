import { FastifyInstance } from 'fastify';
import { db } from '../utils/requestLogger';

export default async function logsRoutes(app: FastifyInstance) {
  app.get('/logs', async (req, reply) => {
    const result = await db.execute(
      'SELECT * FROM request_logs ORDER BY id DESC LIMIT 100'
    );
    reply.status(200).send(result.rows);
  });
}