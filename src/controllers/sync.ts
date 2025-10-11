import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';

export const syncStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');
    const tabelas = [
        'aluno', 'autor', 'disciplina', 'editora', 'emprestimo', 'livro', 'professor'
      ];

    try{
        if(!tabelas){
            return reply.status(400).send({ message: "Tabelas required!" });
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        const resultados = await Promise.all(
            tabelas.map(async (tabela) => {          
              const query = `
                SELECT md5(string_agg(ultimaalteracao::text, ',' ORDER BY ultimaalteracao)) AS hash
                FROM ${tabela};
              `;
          
              const result = await pool.query(query);
              return {
                tabela,
                hash: result.rows[0]?.hash || null,
              };
            })
          );
        reply.status(200).send({ message: 'Sync status fetched successfully!', data:  resultados});
    }catch(err){
        console.log(err)
        reply.status(500).send({ message: 'Something went wrong!', data: err });
    }
};