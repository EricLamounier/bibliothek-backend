import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyJWT } from '../utils/jwt';

export function auth(req: FastifyRequest, res: FastifyReply, next: any) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).send({ error: 'Token não fornecido' });

  try {
    if(!verifyJWT(token)) return res.status(401).send({ error: 'Token inválido ou expirado' });
    next();
  } catch {
    return res.status(401).send({ error: 'Token inválido ou expirado' });
  }
}
