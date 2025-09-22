import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';

export const getDisciplina = async (request: FastifyRequest, reply: FastifyReply) => {
    const { disciplina, situacao } = request.query as { disciplina?: string | string[], situacao?: string | string[] }
    const token = request.cookies.token;
    try{
        if(!token){
            return reply.code(401).send({ error: "Token not found!" });
        }

        const resp = await verifyJWT(token)
        if(!resp){
            return reply.code(401).send({ error: "Invalid JWT Token!" });
        }
    
        //console.log(disciplina, situacao)
        let query = `
        SELECT *, 0 AS sync
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
        values.push(...disciplinas)
        paramIndex += disciplinas.length
        }
    
        if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ')
        }
    
        query += ' GROUP BY CODIGODISCIPLINA, NOME, OBSERVACAO, SITUACAO'
    
        const { rows } = await pool.query(query, values)
        reply.status(200).send({ message: 'Disciplinas fetched successfully!', data: rows });
    }catch(err){
        console.log(err)
        reply.status(400).send({ message: 'Disciplinas not fetched!', data: err });
    }
  
} 

export const postDisciplina = async(request: FastifyRequest, reply: FastifyReply) => {
    const disciplina = request.body as any;
    const token = request.cookies.token;

    try{
        if (!disciplina) {
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
        const data = [disciplina.nome, disciplina.observacao];
        const { rows: result } = await pool.query(query, data);
        result[0].sync = 0;
        result[0].codigodisciplinatemp = disciplina.codigodisciplina
         
        reply.status(200).send({ message: 'Disciplina inserted successfully!', data:  result[0] });    
        
        await pool.query('COMMIT');
    }catch(err){
        await pool.query('ROLLBACK');
        console.log(err)
        reply.status(400).send({ message: 'Disciplina not inserted!', data: err });
    }
};

export const putDisciplina = async (request: FastifyRequest, reply: FastifyReply) => {
    const disciplina = request.body as {disciplina : any};
    const token = request.cookies.token;

    try{
        if(!disciplina){
            return reply.status(400).send({ message: "Disciplina required!" });
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');

        const { codigodisciplina, nome, observacao, situacao } : any = disciplina;
        const data = [nome, observacao, situacao, codigodisciplina];
        const query = 'UPDATE DISCIPLINA SET NOME = $1, OBSERVACAO = $2, SITUACAO = $3 WHERE CODIGODISCIPLINA = $4 RETURNING *';
        const { rows: result } = await pool.query(query, data);
        result[0].sync = 0;
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Disciplina updated successfully!', data:  result[0] });

    }catch(err){
        await pool.query('ROLLBACK');
        console.log(err)
        reply.status(400).send({ message: 'Disciplina not updated!', data: err });
    }
};

export const deleteDisciplina = async (request: FastifyRequest, reply: FastifyReply) => {
    const { disciplina } = request.body as {disciplina : any};
    const token = request.cookies.token;

    try{
        if(!disciplina){
            return reply.status(400).send({ message: "Disciplina required!" })
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');
        const query = `DELETE FROM DISCIPLINA WHERE CODIGODISCIPLINA IN ($1)`;
        await pool.query(query, [disciplina.codigodisciplina]);
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Disciplina deleted successfully!', data:  'sucess'});
    }catch(err){
        await pool.query('ROLLBACK');
        console.log(err)
        reply.status(400).send({ message: 'Disciplina not deleted!', error: err });
    }
};