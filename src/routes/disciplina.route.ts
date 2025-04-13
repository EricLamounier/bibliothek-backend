import { FastifyInstance } from 'fastify';
import { deleteDisciplina, getDisciplina, postDisciplina, putDisciplina } from '../controllers/disciplina.controller';

async function disciplinaRoutes(fastify: FastifyInstance) {
  fastify.post('/post', postDisciplina);
  fastify.get('/get', getDisciplina);
  fastify.delete('/delete', deleteDisciplina);
  fastify.put('/put', putDisciplina);
}

export default disciplinaRoutes;