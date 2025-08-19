import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../src/app';

let ready = false;
async function ensureReady() {
  if (!ready) {
    await app.ready();
    ready = true;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await ensureReady();
    // Encaminha a requisição diretamente para o servidor http interno do Fastify
    app.server.emit('request', req as any, res as any);
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
