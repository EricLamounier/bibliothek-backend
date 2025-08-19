import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';

interface AutorProps {
    userID: number | string;
    nome: string;
    observacao?: string;
};

export const postAutor = async(request: FastifyRequest, reply: FastifyReply) => {
    
    const { nome, observacao } = request.body as {nome : string, observacao ?: string};
    const token = request.cookies.token;

    try{
        if (!nome) {
            return reply.status(400).send({ message: "Autor's name required!" });
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');
        const query = "INSERT INTO AUTOR (NOME, OBSERVACAO) VALUES ($1, $2) RETURNING *";
        const data = [nome, observacao ? (observacao.length > 0 ? observacao : null) : null]
        const {rows} = await pool.query(query, data);
        await pool.query('COMMIT');
 
        reply.status(200).send({ message: 'Autor inserted successfully!', data:  rows[0]});
    }catch(err){
        reply.status(500).send({ message: 'Autor not inserted!', data: err });
    }
};

export const getAutor = async (request: FastifyRequest, reply: FastifyReply) => {
    const { autor, situacao } = request.query as { autor?: string | string[], situacao?: number | number[] }
  
    let query = `SELECT * FROM AUTOR`
    const conditions: string[] = []
    const values: any[] = []
    let paramIndex = 1
  
    if (autor) {
      const autores = Array.isArray(autor) ? autor : [autor]
      const placeholders = autores.map((_, i) => `$${paramIndex + i}`)
      conditions.push(`CODIGOAUTOR IN (${placeholders.join(',')})`)
      values.push(...autores)
      paramIndex += autores.length
    }
  
    if (situacao) {
      const situacoes = Array.isArray(situacao) ? situacao : [situacao]
      const placeholders = situacoes.map((_, i) => `$${paramIndex + i}`)
      conditions.push(`SITUACAO IN (${placeholders.join(',')})`)
      values.push(...situacoes.map(Number))
      paramIndex += situacoes.length
    }
  
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }
  
    query += ' GROUP BY CODIGOAUTOR, NOME, OBSERVACAO, SITUACAO'
  
    //console.log(query, values)
  
    const { rows } = await pool.query(query, values)
  
    reply.status(200).send({ message: 'Autores fetched successfully!', data: rows })
  }
  
export const deleteAutor = async (request: FastifyRequest, reply: FastifyReply) => {
    const { codigoautor } = request.query as {codigoautor : number};
    const token = request.cookies.token;

    try{
        if(!codigoautor){
            return reply.status(400).send({ message: "Autor's ID required!" })
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');
        const data = [codigoautor];
        const query = 'DELETE FROM AUTOR WHERE CODIGOAUTOR = $1';
        const { rows } = await pool.query(query, data);
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Autor deleted successfully!', data:  rows[0]});
    }catch(err){
        reply.status(500).send({ message: 'Autor not deleted!', data: err });
    }


};

export const putAutor = async (request: FastifyRequest, reply: FastifyReply) => {
    const { codigoautor, nome, observacao, situacao } = request.body as {codigoautor : number, nome: string, observacao : string, situacao : number};
    const token = request.cookies.token;

    try{
        if(!codigoautor){
            return reply.status(400).send({ message: "Autor's ID required!" });
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');
        const data = [nome, observacao, situacao, codigoautor];
        const query = 'UPDATE AUTOR SET NOME = $1, OBSERVACAO = $2, SITUACAO = $3 WHERE CODIGOAUTOR = $4';
        const { rows } = await pool.query(query, data);
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Autor updated successfully!', data:  rows[0]});

    }catch(err){
        reply.status(500).send({ message: 'Autor not updated!', data: err });
    }
};