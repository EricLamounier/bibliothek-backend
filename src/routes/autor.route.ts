import { FastifyInstance } from 'fastify';
import { deleteAutor, getAutor, postAutor, putAutor } from '../controllers/autor.controller';

async function autorRoutes(fastify: FastifyInstance) {
  fastify.post('/post', postAutor);
  fastify.get('/get', getAutor);
  fastify.delete('/delete', deleteAutor);
  fastify.put('/put', putAutor);
}

export default autorRoutes;