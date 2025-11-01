import { FastifyInstance } from 'fastify';
import { deleteAluno, getAluno, postAluno, putAluno } from '../controllers/aluno.controller';
import { auth } from '../middlewares/auth';

async function alunoRoutes(fastify: FastifyInstance) {
  fastify.post('/post', { preHandler: [auth] }, postAluno);
  fastify.get('/get', { preHandler: [auth] }, getAluno);
  fastify.delete('/delete', { preHandler: [auth] }, deleteAluno);
  fastify.put('/put', { preHandler: [auth] }, putAluno);
}

export default alunoRoutes;