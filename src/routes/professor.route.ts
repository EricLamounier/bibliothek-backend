import { FastifyInstance } from 'fastify';
import { deleteProfessor, getProfessor, postProfessor, putProfessor } from '../controllers/professor.controller';

async function professorRoutes(fastify: FastifyInstance) {
  fastify.post('/post', postProfessor);
  fastify.get('/get', getProfessor);
  fastify.delete('/delete', deleteProfessor);
  fastify.put('/put', putProfessor);
}

export default professorRoutes;