import { FastifyReply, FastifyRequest } from 'fastify';

export const getBooks = async (request: FastifyRequest, reply: FastifyReply) => {
  // Simulando um retorno de livros
  const books = [
    { id: 1, title: "Livro A", author: "Autor 1" },
    { id: 2, title: "Livro B", author: "Autor 2" }
  ];
  reply.send(books);
};

export const registerBook = async (request: FastifyRequest, reply: FastifyReply) => {
  // Pegando o corpo da requisição
  const { title, author } = request.body as { title: string, author: string };

  // Simulação de salvamento no banco
  const newBook = { id: Date.now(), title, author };

  reply.code(201).send({ message: "Livro criado com sucesso!", book: newBook });
};