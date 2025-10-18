import { FastifyInstance } from 'fastify';
import { db } from '../utils/requestLogger';

export default async function logsRoutes(app: FastifyInstance) {
  app.get('/logs', async (req, reply) => {
    try {
      const {
        inicio,
        fim,
        method,
        status_code,
        limit = 100,
        offset = 0,
        order = 'desc',
      } = req.query as {
        inicio?: string;
        fim?: string;
        method?: string;
        status_code?: string | number;
        limit?: string | number;
        offset?: string | number;
        order?: 'asc' | 'desc';
      };

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (inicio) {
        conditions.push(`"timestamp" >= $${paramIndex++}`);
        params.push(inicio);
      }

      if (fim) {
        conditions.push(`"timestamp" <= $${paramIndex++}`);
        params.push(fim);
      }

      if (method) {
        conditions.push(`"method" = $${paramIndex++}`);
        params.push(method.toUpperCase());
      }

      if (status_code) {
        conditions.push(`"status_code" = $${paramIndex++}`);
        params.push(Number(status_code));
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT 
          "id",
          "timestamp",
          "method",
          "url",
          "status_code",
          "response_time",
          "ip",
          "body",
          "response"
        FROM "request_logs"
        ${whereClause}
        ORDER BY "timestamp" ${order.toUpperCase()}
        LIMIT $${paramIndex++}
        OFFSET $${paramIndex++};
      `;

      params.push(Number(limit), Number(offset));

      const result = await db.execute(query, params);

      reply.status(200).send({
        count: result.rows.length,
        data: result.rows,
      });
    } catch (err) {
      console.error(err);
      reply.status(500).send({ error: 'Erro ao buscar logs' });
    }
  });
}
