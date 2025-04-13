import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';

interface ProfessorProps {
    userID: number | string;
    nome: string;
    observacao?: string;
};

export const postProfessor = async(request: FastifyRequest, reply: FastifyReply) => {
    
    const { nome, observacao } = request.body as {nome : string, observacao ?: string};
    const token = request.cookies.token;

    console.log(nome, observacao);

    console.log(token)

    try{
        if (!nome) {
            return reply.status(400).send({ message: "Professor's name required!" });
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');
        const query = "INSERT INTO PROFESSOR (NOME, OBSERVACAO) VALUES ($1, $2) RETURNING *";
        const data = [nome, observacao ? (observacao.length > 0 ? observacao : null) : null]
        const {rows} = await pool.query(query, data);
        await pool.query('COMMIT');
 
        reply.status(200).send({ message: 'Professor inserted successfully!', data:  rows[0]});
    }catch(err){
        reply.status(200).send({ message: 'Professor not inserted!', data: err });
    }
};

interface ProfessorsPropsGet extends ProfessorProps {
    'IDs[]': number[];
};

export const getProfessor = async (request: FastifyRequest, reply: FastifyReply) => {
    const { nome, situacao } = request.query as { nome?: string; situacao?: number[] }
    const query = `SELECT * FROM PROFESSOR`;
    const { rows } = await pool.query(query);

    reply.status(200).send({ message: 'Professors fetched successfully!', data: rows });
};

export const deleteProfessor = async (request: FastifyRequest, reply: FastifyReply) => {
    const { professorID } = request.query as {professorID : number};
    const token = request.cookies.token;

    try{
        if(!professorID){
            return reply.status(400).send({ message: "Professor's ID required!" })
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');
        const data = [professorID];
        const query = 'DELETE FROM PROFESSOR WHERE ID = $1';
        const { rows } = await pool.query(query, data);
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Professor deleted successfully!', data:  rows[0]});
    }catch(err){
        reply.status(200).send({ message: 'Professor not deleted!', data: err });
    }


};

export const putProfessor = async (request: FastifyRequest, reply: FastifyReply) => {
    const { professorID, nome, observacao, situacao } = request.body as {professorID : number, nome: string, observacao : string, situacao : number};
    const token = request.cookies.token;

    try{
        if(!professorID){
            return reply.status(400).send({ message: "Professor's ID required!" });
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');
        const data = [nome, observacao, situacao, professorID];
        const query = 'UPDATE PROFESSOR SET NOME = $1, OBSERVACAO = $2, SITUACAO = $3 WHERE ID = $4';
        const { rows } = await pool.query(query, data);
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Professor updated successfully!', data:  rows[0]});

    }catch(err){
        reply.status(200).send({ message: 'Professor not updated!', data: err });
    }
};