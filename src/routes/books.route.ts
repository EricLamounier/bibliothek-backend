import { FastifyInstance } from 'fastify';
import { getBooks, registerBook } from '../controllers/books.controller';

async function booksRoute(fastify: FastifyInstance) {
  fastify.get('/', getBooks); // Listar livros
  fastify.post('/', registerBook); // Criar livro
}

export default booksRoute;