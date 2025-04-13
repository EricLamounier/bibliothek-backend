import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';

interface DisciplinaProps {
    userID: number | string;
    nome: string;
    observacao?: string;
};

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

interface DisciplinasPropsGet extends DisciplinaProps {
    'IDs[]': number[];
};

export const getDisciplina = async (request: FastifyRequest, reply: FastifyReply) => {
    const { nome, situacao } = request.query as { nome?: string; situacao?: number[] }
    const query = `SELECT * FROM DISCIPLINA`;
    const { rows } = await pool.query(query);

    reply.status(200).send({ message: 'Disciplinas fetched successfully!', data: rows });
};

export const deleteDisciplina = async (request: FastifyRequest, reply: FastifyReply) => {
    const { disciplinaID } = request.query as {disciplinaID : number};
    const token = request.cookies.token;

    try{
        if(!disciplinaID){
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
        const data = [disciplinaID];
        const query = 'DELETE FROM DISCIPLINA WHERE ID = $1';
        const { rows } = await pool.query(query, data);
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Disciplina deleted successfully!', data:  rows[0]});
    }catch(err){
        reply.status(200).send({ message: 'Disciplina not deleted!', data: err });
    }


};

export const putDisciplina = async (request: FastifyRequest, reply: FastifyReply) => {
    const { disciplinaID, nome, observacao, situacao } = request.body as {disciplinaID : number, nome: string, observacao : string, situacao : number};
    const token = request.cookies.token;

    try{
        if(!disciplinaID){
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
        const data = [nome, observacao, situacao, disciplinaID];
        const query = 'UPDATE DISCIPLINA SET NOME = $1, OBSERVACAO = $2, SITUACAO = $3 WHERE ID = $4';
        const { rows } = await pool.query(query, data);
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Disciplina updated successfully!', data:  rows[0]});

    }catch(err){
        reply.status(200).send({ message: 'Disciplina not updated!', data: err });
    }
};