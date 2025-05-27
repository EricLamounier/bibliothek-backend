import { FastifyInstance } from 'fastify';
import { getTeste, postTeste, putTeste, deleteTeste } from '../controllers/teste.controller';

async function testeRoute(fastify: FastifyInstance) {
  fastify.get('/get', getTeste); // Listar livros
  fastify.post('/post', postTeste); // Criar livro
  fastify.put('/put', putTeste); // Criar livro
  fastify.delete('/delete', deleteTeste); 
}

export default testeRoute