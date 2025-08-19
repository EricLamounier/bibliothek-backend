import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';

export const getEmprestimo = async(request: FastifyRequest, reply: FastifyReply) => {
    
    const token = request.cookies.token;
    const { codigopessoa, livro, datainiciocriacao, datafimcriacao, datainiciodevolucao, datafimdevolucao, situacao } = request.query as { codigopessoa?: number[], livro?: number[], datainiciocriacao?: string, datafimcriacao?: string, datainiciodevolucao?: string, datafimdevolucao?: string, situacao?: number[] };
    
    //console.log(codigopessoa, livro, datainiciocriacao, datafimcriacao, datainiciodevolucao, datafimdevolucao, situacao)
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
                EMP.*,
                PES.*,
                EMP.OBSERVACAO AS OBSERVACAO,
                EMP.SITUACAO AS SITUACAO,
                CAST(SUM(EL.QUANTIDADEDEVOLVIDA) AS INT) AS totaldevolvido,
                CAST(SUM(EL.QUANTIDADEEMPRESTADA) AS INT) AS totalemprestado,
                COALESCE(
                    JSON_AGG(
                    DISTINCT 
                    jsonb_build_object(
                        'codigolivro',                  L.codigolivro,
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
                        'codigoemprestimo', EMP.codigoemprestimo
                    )
                    ) FILTER (WHERE L.codigolivro IS NOT NULL),
                    '[]'
                ) AS livros
                FROM EMPRESTIMO EMP
                JOIN PESSOA    PES ON PES.CODIGOPESSOA = EMP.CODIGOPESSOA
                JOIN FUNCIONARIO FUN ON FUN.CODIGOFUNCIONARIO = EMP.CODIGOFUNCIONARIO
                LEFT JOIN EMPRESTIMO_LIVRO EL ON EL.CODIGOEMPRESTIMO = EMP.CODIGOEMPRESTIMO
                LEFT JOIN LIVRO L ON L.CODIGOLIVRO = EL.CODIGOLIVRO 
            `;
        let data = [];
        let conditions: string[] = [];
        let paramIndex = 1;

        if (codigopessoa) {
            const pessoas = Array.isArray(codigopessoa) ? codigopessoa : [codigopessoa]
            const placeholders = pessoas.map((_, i) => `$${paramIndex + i}`)
            conditions.push(`EMP.CODIGOPESSOA IN (${placeholders.join(',')})`)
            data.push(...pessoas)
            paramIndex += pessoas.length
        }
        if (livro) {
            const livros = Array.isArray(livro) ? livro : [livro]
            const placeholders = livros.map((_, i) => `$${paramIndex + i}`)
            conditions.push(`EL.CODIGOLIVRO IN (${placeholders.join(',')})`)
            data.push(...livros)
            paramIndex += livros.length
        }
        if (datainiciocriacao) {
            conditions.push(`EMP.DATAEMPRESTIMO >= $${paramIndex}`);
            data.push(datainiciocriacao);
            paramIndex += 1
        }
        if (datafimcriacao) {
            conditions.push(`EMP.DATAEMPRESTIMO <= $${paramIndex}`);
            data.push(datafimcriacao);
            paramIndex += 1
        }
        if (datainiciodevolucao) {
            conditions.push(`EMP.DATADEVOLUCAO >= $${paramIndex}`);
            data.push(datainiciodevolucao);
            paramIndex += 1
        }
        if (datafimdevolucao) {
            conditions.push(`EMP.DATADEVOLUCAO <= $${paramIndex}`);
            data.push(datafimdevolucao);
            paramIndex += 1
        }

        if(situacao && situacao.length > 0){
            const situacoes = Array.isArray(situacao) ? situacao : [situacao];
            const statusConditions: string[] = [];
            
            if(situacoes.includes('0')){ // Atrasado
                statusConditions.push(`(EMP.DATADEVOLUCAO IS NULL AND CURRENT_DATE > EMP.DATADEVOLUCAOPREVISTA)`);
            }
            if(situacoes.includes('1')){ // Em dia
                statusConditions.push(`(EMP.DATADEVOLUCAO IS NULL AND CURRENT_DATE <= EMP.DATADEVOLUCAOPREVISTA)`);
            }
            if(situacoes.includes('2')){ // Devolvido
                statusConditions.push(`(EMP.DATADEVOLUCAO IS NOT NULL)`);
            }
            
            if(statusConditions.length > 0) {
                conditions.push(`(${statusConditions.join(' OR ')})`);
            }
        }
        
        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(' AND ');
        }
        
        query += ' GROUP BY EMP.CODIGOEMPRESTIMO, PES.CODIGOPESSOA, PES.NOME;';
        const {rows} = await pool.query(query, data);

        reply.status(200).send({ message: 'Emprestimo found successfully!', data:  rows});
    }catch(err){
        //console.log(err)
        reply.status(500).send({ message: 'Emprestimo not found!', data: err });
    }
}

export const getExisteEmprestimoAberto = async(request: FastifyRequest, reply: FastifyReply) => {
    
    const { codigopessoa } = request.query as { codigopessoa?: number | string };
    
    let query = `
        SELECT COUNT(*) 
        FROM EMPRESTIMO E JOIN EMPRESTIMO_LIVRO EL ON E.CODIGOEMPRESTIMO = EL.CODIGOEMPRESTIMO
        WHERE EL.QUANTIDADEEMPRESTADA <> EL.QUANTIDADEDEVOLVIDA 
    `;

    const params: any[] = [];

    if (codigopessoa) {
        params.push(codigopessoa);
        query += ` AND E.CODIGOPESSOA = $${params.length}`;
    }

    const { rows: emprestimos } = await pool.query(query, params);
    if(emprestimos[0].count > 0){
        return reply.status(200).send({ message: 'Emprestimo fetched successfully!', data: true });
    }

    reply.status(200).send({ message: 'Emprestimo fetched successfully!', data: false });
}

export const postEmprestimo = async(request: FastifyRequest, reply: FastifyReply) => {
    
    const { emprestimo } = request.body
    const token = request.cookies.token;

    try{
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
        const query = "INSERT INTO EMPRESTIMO (CODIGOPESSOA, CODIGOFUNCIONARIO, DATAEMPRESTIMO, DATADEVOLUCAOPREVISTA, OBSERVACAO) VALUES ($1, $2, $3, $4, $5) RETURNING *";
        const data = [emprestimo.codigopessoa, emprestimo.codigofuncionario, emprestimo.dataemprestimo, emprestimo.datadevolucaoprevista, emprestimo.observacao]
        const {rows : newEmprestimo} = await pool.query(query, data);

        const livros = emprestimo.livros;

        for (const livro of livros) {
            const queryLivros = "INSERT INTO EMPRESTIMO_LIVRO (CODIGOEMPRESTIMO, CODIGOLIVRO, QUANTIDADEEMPRESTADA) VALUES ($1, $2, $3) RETURNING *";
            const dataLivros = [newEmprestimo[0].codigoemprestimo, livro.codigolivro, livro.quantidade]
            await pool.query(queryLivros, dataLivros);
        }

        await pool.query('COMMIT');
        const formtedEmprestimo = {
            ...emprestimo,
            ...newEmprestimo[0]
        }
 
        reply.status(200).send({ message: 'Emprestimo inserted successfully!', data:  formtedEmprestimo});
    }catch(err){
        await pool.query('ROLLBACK');
        //console.log(err)
        reply.status(500).send({ message: 'Emprestimo not inserted!', data: err });
    }
    
}

export const devolveEmprestimo = async(request: FastifyRequest, reply: FastifyReply) => {
    const { emprestimo } = request.body 
    const token = request.cookies.token;    
    
    if(!token){
        return reply.status(401).send({ message: 'Token not found!' });
    }
    
    const res = await verifyJWT(token);

    if(!res){
        return reply.status(401).send({ message: 'Expired section!', data: ''});
    }

    try{
        await pool.query('BEGIN');
        const query = "UPDATE EMPRESTIMO SET DATADEVOLUCAO = $1, OBSERVACAO = $2 WHERE CODIGOEMPRESTIMO = $3 RETURNING *";
        const data = [emprestimo.datadevolucao, emprestimo.observacao, emprestimo.codigoemprestimo]
        const {rows} = await pool.query(query, data);

        const livros = emprestimo.livros;

        for (const livro of livros) {
            const queryThisLivro = "SELECT * FROM LIVRO WHERE CODIGOLIVRO = $1";
            const dataThisLivro = [livro.codigolivro]
            const {rows: thisLivro} = await pool.query(queryThisLivro, dataThisLivro);
            
            const queryLivro = "UPDATE EMPRESTIMO_LIVRO SET QUANTIDADEDEVOLVIDA = QUANTIDADEDEVOLVIDA + $1 WHERE CODIGOEMPRESTIMO = $2 AND CODIGOLIVRO = $3 RETURNING *";
            const dataLivro = [livro.quantidade, emprestimo.codigoemprestimo, livro.codigolivro]        
            const {rows: emprestimoLivros} = await pool.query(queryLivro, dataLivro);
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
        
    if(!token){
        return reply.status(401).send({ message: 'Token not found!' });
    }
    
    const res = await verifyJWT(token);

    if(!res){
        return reply.status(401).send({ message: 'Expired section!', data: ''});
    }

    try{
        await pool.query('BEGIN');
        const query = "UPDATE EMPRESTIMO SET DATADEVOLUCAOPREVISTA = $1, OBSERVACAO = $2 WHERE CODIGOEMPRESTIMO = $3 RETURNING *";
        const data = [emprestimo.datadevolucaoprevista, emprestimo.observacao, emprestimo.codigoemprestimo]
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
