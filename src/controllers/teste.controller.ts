import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';

export const getTeste = async (request: FastifyRequest, reply: FastifyReply) => {
  // Simulando um retorno de livros
  const teste = [
    { id: 1, title: "Livro A", author: "Autor 1" },
    { id: 2, title: "Livro B", author: "Autor 2" }
  ];
  reply.send(teste);
};

export const postTeste = async (request: FastifyRequest, reply: FastifyReply) => {
  

  reply.send('teste');
};

export const putTeste = async (request: FastifyRequest, reply: FastifyReply) => {
  
  const t = request.body;
  const select = "SELECT * FROM ALUNO";
  
  const query = "UPDATE ALUNO SET DATA_MATRICULA = $1 WHERE ID = $2"
  const data = ['01/01/2001', 15]

  const r = await pool.query(query, data);

  const {rows: alunos} = await pool.query(select)
  reply.send(t);
};

export const deleteTeste = async (request: FastifyRequest, reply: FastifyReply) => {
  

  reply.send('teste');
};