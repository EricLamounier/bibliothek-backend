import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';

export const getDisciplina = async (request: FastifyRequest, reply: FastifyReply) => {
    const { disciplina, situacao } = request.query as { disciplina?: string | string[], situacao?: string | string[] }
  
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
      //console.log(disciplinas)
      values.push(...disciplinas)
      paramIndex += disciplinas.length
    }
  
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }
  
    query += ' GROUP BY CODIGODISCIPLINA, NOME, OBSERVACAO, SITUACAO'
    //console.log(query, values)
  
    const { rows } = await pool.query(query, values)
    //console.log(rows)
    reply.status(200).send({ message: 'Disciplinas fetched successfully!', data: rows })
  
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

        let rows: any[] = [];
        const formatedDisciplina = Array.isArray(disciplina) ? disciplina : [disciplina];

        await pool.query('BEGIN');
        
        for (const d of formatedDisciplina) {
            const { nome, observacao } = d;
            const query = "INSERT INTO DISCIPLINA (NOME, OBSERVACAO) VALUES ($1, $2) RETURNING *";
            const data = [nome, observacao];
            const { rows: rowsReturned } = await pool.query(query, data);
            rows.push({ ...rowsReturned[0], sync: 0 });
        }        
        
        await pool.query('COMMIT');
        reply.status(200).send({ message: 'Disciplina inserted successfully!', data: rows });
    }catch(err){
        await pool.query('ROLLBACK');
        reply.status(400).send({ message: 'Disciplina not inserted!', data: err });
    }
}; 

export const putDisciplina = async (request: FastifyRequest, reply: FastifyReply) => {
    const disciplina = request.body as {disciplina : any};
    //console.log(disciplina)
    const token = request.cookies.token;

    try{
        if(!disciplina){
            return reply.status(400).send({ message: "Disciplina's ID required!" });
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        let rows: any[] = [];
        const formatedDisciplina = Array.isArray(disciplina) ? disciplina : [disciplina];

        await pool.query('BEGIN');
        for (const d of formatedDisciplina) {
            const { codigodisciplina, nome, observacao, situacao } = d;
            const data = [nome, observacao, situacao, codigodisciplina];
            const query = 'UPDATE DISCIPLINA SET NOME = $1, OBSERVACAO = $2, SITUACAO = $3 WHERE CODIGODISCIPLINA = $4';
            const { rows: rowsReturned } = await pool.query(query, data);
            rows.push({ ...rowsReturned[0], sync: 0 });
        }        
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Disciplina updated successfully!', data:  rows});

    }catch(err){
        await pool.query('ROLLBACK');
        //console.log(err)
        reply.status(400).send({ message: 'Disciplina not updated!', data: err });
    }
};

export const deleteDisciplina = async (request: FastifyRequest, reply: FastifyReply) => {
    const { disciplinas } = request.body as {disciplinas : any[]};
    const token = request.cookies.token;

    //console.log(disciplinas)

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
        //console.log(query)
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Disciplina deleted successfully!', data:  'sucess'});
    }catch(err){
        //console.log(err)
        reply.status(400).send({ message: 'Disciplina not deleted!', data: err });
    }


};