import { FastifyInstance } from 'fastify';
import { deleteEmprestimo, devolveEmprestimo, getEmprestimo, postEmprestimo, renovaEmprestimo } from '../controllers/emprestimo.controller';

async function autorRoutes(fastify: FastifyInstance) {
  fastify.post('/post', postEmprestimo);
  fastify.get('/get', getEmprestimo);
  fastify.delete('/delete', deleteEmprestimo);
  fastify.post('/devolve', devolveEmprestimo);
  fastify.post('/renova', renovaEmprestimo);
}

export default autorRoutes;