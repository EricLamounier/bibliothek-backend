import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';
import { capitalizarTexto } from '../utils/utils';

export const postEditora = async(request: FastifyRequest, reply: FastifyReply) => {
    
    const { nome, observacao } = request.body as {nome : string, observacao ?: string};
    const token = request.cookies.token;

    console.log(nome, observacao);

    console.log(token)

    try{
        if (!nome) {
            return reply.status(400).send({ message: "Editora's name required!" });
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');
        const query = "INSERT INTO EDITORA (NOME, OBSERVACAO) VALUES ($1, $2) RETURNING *";
        const data = [capitalizarTexto(nome), capitalizarTexto(observacao)]
        const {rows} = await pool.query(query, data);
        await pool.query('COMMIT');
 
        reply.status(200).send({ message: 'Editora inserted successfully!', data:  rows[0]});
    }catch(err){
        reply.status(200).send({ message: 'Editora not inserted!', data: err });
    }
};

export const getEditora = async (request: FastifyRequest, reply: FastifyReply) => {
    const { nome, situacao } = request.query as { nome?: string; situacao?: number[] }
    const query = `SELECT * FROM EDITORA`;
    const { rows } = await pool.query(query);

    reply.status(200).send({ message: 'Editoras fetched successfully!', data: rows });
};

export const deleteEditora = async (request: FastifyRequest, reply: FastifyReply) => {
    const { codigoeditora } = request.query as {codigoeditora : number};
    const token = request.cookies.token;

    try{
        if(!codigoeditora){
            return reply.status(400).send({ message: "Editora's ID required!" })
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');
        const data = [codigoeditora];
        const query = 'DELETE FROM EDITORA WHERE CODIGOEDITORA = $1';
        const { rows } = await pool.query(query, data);
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Editora deleted successfully!', data:  rows[0]});
    }catch(err){
        reply.status(200).send({ message: 'Editora not deleted!', data: err });
    }


};

export const putEditora = async (request: FastifyRequest, reply: FastifyReply) => {
    const { codigoeditora, nome, observacao, situacao } = request.body as {codigoeditora : number, nome: string, observacao : string, situacao : number};
    const token = request.cookies.token;

    console.log(codigoeditora, nome, observacao, situacao)

    try{
        if(codigoeditora === undefined){
            return reply.status(400).send({ message: "Editora's ID required!" });
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');
        const data = [nome, observacao, situacao, codigoeditora];
        const query = 'UPDATE EDITORA SET NOME = $1, OBSERVACAO = $2, SITUACAO = $3 WHERE CODIGOEDITORA = $4 RETURNING *';
        const { rows } = await pool.query(query, data);
        await pool.query('COMMIT');
        console.log('e')
        reply.status(200).send({ message: 'Editora updated successfully!', data:  rows[0]});

    }catch(err){
        console.log(err)
        reply.status(200).send({ message: 'Editora not updated!', data: err });
    }
};