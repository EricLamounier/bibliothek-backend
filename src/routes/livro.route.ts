import { FastifyInstance } from 'fastify';
import { deleteLivro, getLivro, postLivro, putLivro } from '../controllers/livro.controller';

async function livroRoutes(fastify: FastifyInstance) {
  fastify.post('/post', postLivro);
  fastify.get('/get', getLivro);
  fastify.delete('/delete', deleteLivro);
  fastify.put('/put', putLivro);
}

export default livroRoutes;