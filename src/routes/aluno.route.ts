import { FastifyInstance } from 'fastify';
import { deleteAluno, getAluno, postAluno, putAluno } from '../controllers/aluno.controller';

async function alunoRoutes(fastify: FastifyInstance) {
  fastify.post('/post', postAluno);
  fastify.get('/get', getAluno);
  fastify.delete('/delete', deleteAluno);
  fastify.put('/put', putAluno);
}

export default alunoRoutes;