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

    console.log(nome, observacao);

    console.log(token)

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
        reply.status(200).send({ message: 'Autor not inserted!', data: err });
    }
};

interface AutorsPropsGet extends AutorProps {
    'IDs[]': number[];
};

export const getAutor = async (request: FastifyRequest, reply: FastifyReply) => {
    const { nome, situacao } = request.query as { nome?: string; situacao?: number[] }
    const query = `SELECT * FROM AUTOR`;
    const { rows } = await pool.query(query);

    reply.status(200).send({ message: 'Autors fetched successfully!', data: rows });
};

export const deleteAutor = async (request: FastifyRequest, reply: FastifyReply) => {
    const { autorID } = request.query as {autorID : number};
    const token = request.cookies.token;

    try{
        if(!autorID){
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
        const data = [autorID];
        const query = 'DELETE FROM AUTOR WHERE ID = $1';
        const { rows } = await pool.query(query, data);
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Autor deleted successfully!', data:  rows[0]});
    }catch(err){
        reply.status(200).send({ message: 'Autor not deleted!', data: err });
    }


};

export const putAutor = async (request: FastifyRequest, reply: FastifyReply) => {
    const { autorID, nome, observacao, situacao } = request.body as {autorID : number, nome: string, observacao : string, situacao : number};
    const token = request.cookies.token;

    try{
        if(!autorID){
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
        const data = [nome, observacao, situacao, autorID];
        const query = 'UPDATE AUTOR SET NOME = $1, OBSERVACAO = $2, SITUACAO = $3 WHERE ID = $4';
        const { rows } = await pool.query(query, data);
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Autor updated successfully!', data:  rows[0]});

    }catch(err){
        reply.status(200).send({ message: 'Autor not updated!', data: err });
    }
};