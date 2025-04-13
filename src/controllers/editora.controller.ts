import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';

interface EditoraProps {
    userID: number | string;
    nome: string;
    observacao?: string;
};

function capitalize(str : string | undefined) : string | undefined {
    return str && str.split(" ").map((word : string) => capitalize(word)).join(" ");
};

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
        const data = [nome, observacao ? (observacao.length > 0 ? observacao : null) : null]
        const {rows} = await pool.query(query, data);
        await pool.query('COMMIT');
 
        reply.status(200).send({ message: 'Editora inserted successfully!', data:  rows[0]});
    }catch(err){
        reply.status(200).send({ message: 'Editora not inserted!', data: err });
    }
};

interface EditorasPropsGet extends EditoraProps {
    'IDs[]': number[];
};

export const getEditora = async (request: FastifyRequest, reply: FastifyReply) => {
    const { nome, situacao } = request.query as { nome?: string; situacao?: number[] }
    const query = `SELECT * FROM EDITORA`;
    const { rows } = await pool.query(query);

    reply.status(200).send({ message: 'Editoras fetched successfully!', data: rows });
};

export const getEditora0 = async (request: FastifyRequest, reply: FastifyReply) => {
    try {

        /*const { nome, 'situacao[]': situacao } = request.query as { nome?: string; 'situacao[]'?: number[] };
        const token = request.cookies.token;
        
        console.log(nome, situacao)
        return reply.status(200).send({ message: 'Editoras fetched successfully!', data: [] });

        if (!token) {
            return reply.status(401).send({ message: 'Token not found!' });
        }

        if (!await verifyJWT(token)) {
            return reply.status(401).send({ message: 'Expired session!', data: '' });
        }

        /*const params: (number | string)[] = [`%${nome.toLowerCase()}%`];
        let query = `SELECT * FROM EDITORA WHERE LOWER(NOME) LIKE $1`;

        if (situacao !== undefined) {
            params.push(situacao);
            query += ` AND SITUACAO = $${params.length}`;
        }

        if (Array.isArray(IDs) && IDs.length > 0) {
            const idPlaceholders = IDs.map((_, index) => `$${params.length + index + 1}`).join(', ');
            query += ` AND ID IN (${idPlaceholders})`;
            params.push(...IDs);
        }

        const { rows } = await pool.query(query, params);*/
        //reply.status(200).send({ message: 'Editoras fetched successfully!', data: rows });
        reply.status(200).send({ message: 'Editoras fetched successfully!', data: 'rows' });
    } catch (err) {
        console.error(err);
        reply.status(500).send({ message: 'Failed to fetch Editoras!', data: err });
    }
};

export const deleteEditora = async (request: FastifyRequest, reply: FastifyReply) => {
    const { editoraID } = request.query as {editoraID : number};
    const token = request.cookies.token;

    try{
        if(!editoraID){
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
        const data = [editoraID];
        const query = 'DELETE FROM EDITORA WHERE ID = $1';
        const { rows } = await pool.query(query, data);
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Editora deleted successfully!', data:  rows[0]});
    }catch(err){
        reply.status(200).send({ message: 'Editora not deleted!', data: err });
    }


};

export const putEditora = async (request: FastifyRequest, reply: FastifyReply) => {
    const { editoraID, nome, observacao, situacao } = request.body as {editoraID : number, nome: string, observacao : string, situacao : number};
    const token = request.cookies.token;

    try{
        if(!editoraID){
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
        const data = [nome, observacao, situacao, editoraID];
        const query = 'UPDATE EDITORA SET NOME = $1, OBSERVACAO = $2, SITUACAO = $3 WHERE ID = $4';
        const { rows } = await pool.query(query, data);
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Editora updated successfully!', data:  rows[0]});

    }catch(err){
        reply.status(200).send({ message: 'Editora not updated!', data: err });
    }
};