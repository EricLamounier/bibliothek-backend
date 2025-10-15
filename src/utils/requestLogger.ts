// src/plugins/requestLogger.ts
import fp from 'fastify-plugin';
import dotenv from 'dotenv';
dotenv.config();
const { createClient } = require('@libsql/client');

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default fp(async (fastify) => {
  fastify.addHook('onRequest', async (request) => {
    (request as any).startTime = Date.now();
  });

  fastify.addHook('preHandler', async (request, reply) => {
    // intercepta o send() para capturar o corpo da resposta
    const originalSend = reply.send.bind(reply);
    (reply as any)._responsePayload = null;

    reply.send = (payload: any) => {
      (reply as any)._responsePayload = payload;
      return originalSend(payload);
    };
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const startTime = (request as any).startTime;
    const responseTime = isFinite(startTime) ? Date.now() - startTime : 0;

    const { method, url, ip, body } = request;
    const statusCode = isFinite(reply.statusCode) ? reply.statusCode : 0;
    const responseBody = (reply as any)._responsePayload;

    if (url === '/favicon.ico') return;
    if (request.method === 'OPTIONS') return;

    try {
      await db.execute({
        sql: `INSERT INTO request_logs 
              (timestamp, method, url, status_code, response_time, ip, body, response)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          new Date().toISOString(),
          method,
          url,
          statusCode,
          responseTime,
          ip,
          JSON.stringify(body || {}),
          JSON.stringify(responseBody || {}),
        ],
      });
    } catch (err) {
      fastify.log.error('Erro ao salvar log: ' + err);
    }
  });
});