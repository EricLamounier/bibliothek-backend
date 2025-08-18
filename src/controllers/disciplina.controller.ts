import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';

export const postDisciplina = async(request: FastifyRequest, reply: FastifyReply) => {
    
    const { nome, observacao } = request.body as {nome : string, observacao ?: string};
    const token = request.cookies.token;

    try{
        if (!nome) {
            return reply.status(400).send({ message: "Disciplina's name required!" });
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');
        const query = "INSERT INTO DISCIPLINA (NOME, OBSERVACAO) VALUES ($1, $2) RETURNING *";
        const data = [nome, observacao ? (observacao.length > 0 ? observacao : null) : null]
        const {rows} = await pool.query(query, data);
        await pool.query('COMMIT');
 
        reply.status(200).send({ message: 'Disciplina inserted successfully!', data:  rows[0]});
    }catch(err){
        reply.status(200).send({ message: 'Disciplina not inserted!', data: err });
    }
};

export const getDisciplina = async (request: FastifyRequest, reply: FastifyReply) => {
    const { disciplina, situacao } = request.query as { disciplina?: string | string[], situacao?: string | string[] }
  
    console.log(disciplina, situacao)
    let query = `
      SELECT * 
      FROM DISCIPLINA
    `
    const conditions: string[] = []
    const values: any[] = []
    let paramIndex = 1
  
    // filtro por situação
    if (situacao) {
      const situacoes = Array.isArray(situacao) ? situacao : [situacao]
      const placeholders = situacoes.map((_, i) => `$${paramIndex + i}`)
      conditions.push(`SITUACAO IN (${placeholders.join(',')})`)
      values.push(...situacoes.map(Number)) // garante que seja número
      paramIndex += situacoes.length
    }

    if (disciplina) {
      const disciplinas = Array.isArray(disciplina) ? disciplina : [disciplina]
      const placeholders = disciplinas.map((_, i) => `$${paramIndex + i}`)
      conditions.push(`CODIGODISCIPLINA IN (${placeholders.join(',')})`)
      console.log(disciplinas)
      values.push(...disciplinas)
      paramIndex += disciplinas.length
    }
  
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }
  
    query += ' GROUP BY CODIGODISCIPLINA, NOME, OBSERVACAO, SITUACAO'
    console.log(query, values)
  
    const { rows } = await pool.query(query, values)
    reply.status(200).send({ message: 'Disciplinas fetched successfully!', data: rows })
  }  

export const deleteDisciplina = async (request: FastifyRequest, reply: FastifyReply) => {
    const { disciplinas } = request.body as {disciplinas : any[]};
    const token = request.cookies.token;

    try{
        if(!disciplinas){
            return reply.status(400).send({ message: "Disciplinas required!" })
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');
        const ids = disciplinas.map(d => d.codigodisciplina);
        const placeholders = ids.map((_, index) => `$${index + 1}`).join(", ");
        const query = `DELETE FROM DISCIPLINA WHERE CODIGODISCIPLINA IN (${placeholders})`;
        await pool.query(query, ids);
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Disciplina deleted successfully!', data:  'sucess'});
    }catch(err){
        reply.status(200).send({ message: 'Disciplina not deleted!', data: err });
    }


};

export const putDisciplina = async (request: FastifyRequest, reply: FastifyReply) => {
    const { codigodisciplina, nome, observacao, situacao } = request.body as {codigodisciplina : number, nome: string, observacao : string, situacao : number};
    const token = request.cookies.token;

    try{
        if(!codigodisciplina){
            return reply.status(400).send({ message: "Disciplina's ID required!" });
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');
        const data = [nome, observacao, situacao, codigodisciplina];
        const query = 'UPDATE DISCIPLINA SET NOME = $1, OBSERVACAO = $2, SITUACAO = $3 WHERE CODIGODISCIPLINA = $4';
        const { rows } = await pool.query(query, data);
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Disciplina updated successfully!', data:  rows[0]});

    }catch(err){
        reply.status(200).send({ message: 'Disciplina not updated!', data: err });
    }
};