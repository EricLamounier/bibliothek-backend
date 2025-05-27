import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';

export const postEmprestimo = async(request: FastifyRequest, reply: FastifyReply) => {
    
    const { emprestimo } = request.body
    const token = request.cookies.token;

    try{
        console.log(emprestimo)
        if(!emprestimo){
            return reply.status(400).send({ message: "Emprestimo required!" })
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');
        const query = "INSERT INTO EMPRESTIMO (PESSOA_ID, FUNCIONARIO_ID, DATAEMPRESTIMO, DATADEVOLUCAOPREVISTA, OBSERVACAO) VALUES ($1, $2, $3, $4, $5) RETURNING *";
        const data = [emprestimo.pessoa_id, emprestimo.funcionario_id, emprestimo.dataemprestimo, emprestimo.datadevolucaoprevista, emprestimo.observacao]
        const {rows} = await pool.query(query, data);

        const livros = emprestimo.livros;

        for (const livro of livros) {
            const queryLivros = "INSERT INTO EMPRESTIMO_LIVRO (EMPRESTIMO_ID, LIVRO_ID, QUANTIDADEEMPRESTADA) VALUES ($1, $2, $3) RETURNING *";
            const dataLivros = [rows[0].id, livro.id, livro.quantidade]
            await pool.query(queryLivros, dataLivros);
        }

        await pool.query('COMMIT');
        const newEmprestimo = {...emprestimo, emprestimo_id: rows[0].id}
        console.log(newEmprestimo)
 
        reply.status(200).send({ message: 'Emprestimo inserted successfully!', data:  newEmprestimo});
    }catch(err){
        await pool.query('ROLLBACK');
        console.log(err)
        reply.status(500).send({ message: 'Emprestimo not inserted!', data: err });
    }
    
}

export const getEmprestimo = async(request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies.token;
    const { pessoa_id } = request.query;

    ////console.log(pessoa_id)

    try{

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        let query = `
            SELECT 
                EMP.ID AS emprestimo_id,
                EMP.FUNCIONARIO_ID          AS funcionario_id,
                EMP.DATAEMPRESTIMO,
                EMP.DATADEVOLUCAO,
                EMP.DATADEVOLUCAOPREVISTA,
                EMP.OBSERVACAO,
                PES.NOME,
                PES.TIPO AS pessoa_tipo,
                EMP.PESSOA_ID               AS pessoa_id,
                SUM(EL.QUANTIDADEDEVOLVIDA) AS totaldevolvido,
                SUM(EL.QUANTIDADEEMPRESTADA)          AS totalemprestado,
                COALESCE(
                    JSON_AGG(
                    DISTINCT 
                    jsonb_build_object(
                        'id',                  L.id,
                        'titulo',              L.titulo,
                        'quantidadeemprestada',          EL.quantidadeemprestada,
                        'quantidadedevolvida', EL.quantidadedevolvida,
                        'imagem', L.imagem,
                        'imagem_url',
                        CASE 
                            WHEN L.imagem IS NOT NULL
                            THEN 'ttps://ik.imagekit.io/bibliothek/LivrosImagens/' || L.imagem || '.png'
                            ELSE NULL
                        END,
                        'emprestimo_id', EMP.ID
                    )
                    ) FILTER (WHERE L.id IS NOT NULL),
                    '[]'
                ) AS livros
                FROM EMPRESTIMO EMP
                JOIN PESSOA    PES ON PES.ID = EMP.PESSOA_ID
                JOIN FUNCIONARIO FUN ON FUN.ID = EMP.FUNCIONARIO_ID
                LEFT JOIN EMPRESTIMO_LIVRO EL ON EL.EMPRESTIMO_ID = EMP.ID
                LEFT JOIN LIVRO             L  ON L.ID           = EL.LIVRO_ID 
            `;
        let data = [];

        if(pessoa_id){
            query += 'WHERE EMP.PESSOA_ID = $1 ';
            data.push(pessoa_id);
        }

        query += 'GROUP BY EMP.ID, PES.ID, PES.NOME;'
        const {rows} = await pool.query(query, data);
        //console.log(rows)

        reply.status(200).send({ message: 'Emprestimo found successfully!', data:  rows});
    }catch(err){
        console.log(err)
        reply.status(500).send({ message: 'Emprestimo not found!', data: err });
    }
}

export const devolveEmprestimo = async(request: FastifyRequest, reply: FastifyReply) => {
    const { emprestimo } = request.body 
    const token = request.cookies.token;    
    //console.log(emprestimo)
    
    if(!token){
        return reply.status(401).send({ message: 'Token not found!' });
    }
    
    const res = await verifyJWT(token);

    if(!res){
        return reply.status(401).send({ message: 'Expired section!', data: ''});
    }

    try{
        await pool.query('BEGIN');
        const query = "UPDATE EMPRESTIMO SET DATADEVOLUCAO = $1 WHERE ID = $2 RETURNING *";
        const data = [emprestimo.datadevolucao, emprestimo.emprestimo_id]
        const {rows} = await pool.query(query, data);

        const livros = emprestimo.livros;
        ////console.log(livros)

        for (const livro of livros) {
            const queryThisLivro = "SELECT * FROM LIVRO WHERE ID = $1";
            const dataThisLivro = [livro.id]
            const {rows: thisLivro} = await pool.query(queryThisLivro, dataThisLivro);
            ////console.log(thisLivro)
            
            const queryLivro = "UPDATE EMPRESTIMO_LIVRO SET QUANTIDADEDEVOLVIDA = QUANTIDADEDEVOLVIDA + $1 WHERE EMPRESTIMO_ID = $2 AND LIVRO_ID = $3 RETURNING *";
            const dataLivro = [livro.quantidade, emprestimo.emprestimo_id, livro.id]        
            const {rows: emprestimoLivros} = await pool.query(queryLivro, dataLivro);
            //console.log(emprestimoLivros)

            if(thisLivro[0].quantidadedisponivel === 0 || thisLivro[0].quantidadedisponivel < livro.quantidade){
                await pool.query('ROLLBACK');
                return reply.status(400).send({ message: "Livro not available!" })
            }
        }
        await pool.query('COMMIT');
        reply.status(200).send({ message: 'Emprestimo returned successfully!', data:  'sucess' });
    }catch(err){
        await pool.query('ROLLBACK');
        //console.log(err)
        reply.status(500).send({ message: 'Emprestimo not returned!', data: err });
    }
}

export const renovaEmprestimo = async(request: FastifyRequest, reply: FastifyReply) => {
    const { emprestimo } = request.body 
    const token = request.cookies.token;   
    
    //console.log(emprestimo)
    
    if(!token){
        return reply.status(401).send({ message: 'Token not found!' });
    }
    
    const res = await verifyJWT(token);

    if(!res){
        return reply.status(401).send({ message: 'Expired section!', data: ''});
    }

    try{
        await pool.query('BEGIN');
        const query = "UPDATE EMPRESTIMO SET DATADEVOLUCAOPREVISTA = $1 WHERE ID = $2 RETURNING *";
        const data = [emprestimo.datadevolucaoprevista, emprestimo.emprestimo_id]
        const {rows} = await pool.query(query, data);

        await pool.query('COMMIT');
    }catch(err){
        await pool.query('ROLLBACK');
        reply.status(500).send({ message: 'Emprestimo not returned!', data: err });
    }
    
    reply.status(200).send({ message: 'Emprestimo returned successfully!', data:  'sucess' });
}



export const deleteEmprestimo = async(request: FastifyRequest, reply: FastifyReply) => {
    
    
}
