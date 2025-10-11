import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';

export const getAutor = async (request: FastifyRequest, reply: FastifyReply) => {
    const { autor, situacao } = request.query as { autor?: string | string[], situacao?: number | number[] }
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');
    
    try{
        if(!token){
            return reply.code(401).send({ error: "Token not found!" });
        }

        const resp = await verifyJWT(token)
        if(!resp){
            return reply.code(401).send({ error: "Invalid JWT Token!" });
        }
    
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
    
        const { rows } = await pool.query(query, values)
    
        reply.status(200).send({ message: 'Autores fetched successfully!', data: rows })
    }catch(err){
        console.log(err)
        reply.status(500).send({ message: 'Autores not fetched!', data: err });
    }
}

export const postAutor = async(request: FastifyRequest, reply: FastifyReply) => {
    const autor = request.body as any;
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');

    try{
        if (!autor) {
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
        const data = [autor.nome, autor.observacao ? (autor.observacao.length > 0 ? autor.observacao : null) : null]
        const {rows} = await pool.query(query, data);
        await pool.query('COMMIT');

        const novoAutor = {
            ...rows[0],
            sync: 0,
            codigoautortemp: autor.codigoautor
        }
 
        reply.status(200).send({ message: 'Autor inserted successfully!', data:  novoAutor});
    }catch(err){
        await pool.query('ROLLBACK');
        console.log(err)
        reply.status(500).send({ message: 'Autor not inserted!', data: err });
    }
};

export const putAutor = async (request: FastifyRequest, reply: FastifyReply) => {
    const autor = request.body as any;
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');

    try{
        if(!autor){
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
        const data = [autor.nome, autor.observacao, autor.situacao, autor.codigoautor];
        const query = 'UPDATE AUTOR SET NOME = $1, OBSERVACAO = $2, SITUACAO = $3 WHERE CODIGOAUTOR = $4 RETURNING *';
        const { rows } = await pool.query(query, data);
        await pool.query('COMMIT');
        
        const novoAutor = {
            ...rows[0],
            sync: 0,
        }
        reply.status(200).send({ message: 'Autor updated successfully!', data:  novoAutor});

    }catch(err){
        console.log(err)
        await pool.query('ROLLBACK');
        reply.status(500).send({ message: 'Autor not updated!', data: err });
    }
};
  
export const deleteAutor = async (request: FastifyRequest, reply: FastifyReply) => {
    const {autor} = request.body as any;
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');

    try{
        if(!autor){
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
        const data = [autor.codigoautor];
        const query = 'DELETE FROM AUTOR WHERE CODIGOAUTOR = $1';
        const { rows } = await pool.query(query, data);
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Autor deleted successfully!', data:  rows[0]});
    }catch(err){
        await pool.query('ROLLBACK');
        console.log(err)
        reply.status(500).send({ message: 'Autor not deleted!', data: err });
    }


};