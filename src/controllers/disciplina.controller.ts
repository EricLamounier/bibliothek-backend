import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';

export const postDisciplina = async(request: FastifyRequest, reply: FastifyReply) => {
    
    const { nome, observacao } = request.body as {nome : string, observacao ?: string};
    const token = request.cookies.token;

    console.log(nome, observacao);

    console.log(token)

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
    const { nome, situacao } = request.query as { nome?: string; situacao?: number[] }
    const query = `SELECT * FROM DISCIPLINA`;
    const { rows } = await pool.query(query);

    //console.log(rows)

    reply.status(200).send({ message: 'Disciplinas fetched successfully!', data: rows });
};

export const deleteDisciplina = async (request: FastifyRequest, reply: FastifyReply) => {
    const { codigodisciplina } = request.body as {codigodisciplina : number[]};
    const token = request.cookies.token;

    console.log(request.body)

    try{
        if(!codigodisciplina){
            return reply.status(400).send({ message: "Disciplina's ID required!" })
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');
        const ids = codigodisciplina.map(d => d);
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

    console.log(request.body)

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