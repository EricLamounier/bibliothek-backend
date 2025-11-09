import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';

export const getEmprestimo = async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');
    const {
        codigopessoa,
        livro,
        datainiciocriacao,
        datafimcriacao,
        datainiciodevolucao,
        datafimdevolucao,
        situacao
    } = request.query as {
        codigopessoa?: number[],
        livro?: number[],
        datainiciocriacao?: string,
        datafimcriacao?: string,
        datainiciodevolucao?: string,
        datafimdevolucao?: string,
        situacao?: string[]
    };

    try {
        if (!token) {
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);
        if (!res) {
            return reply.status(401).send({ message: 'Expired session!', data: '' });
        }

        // -------------------------------
        // INÍCIO DA QUERY BASE
        // -------------------------------
        let query = `
            SELECT 
                EMP.*,
                PES.*,
                EMP.OBSERVACAO AS OBSERVACAO,
                CAST(SUM(EL.QUANTIDADEDEVOLVIDA) AS INT) AS totaldevolvido,
                CAST(SUM(EL.QUANTIDADEEMPRESTADA) AS INT) AS totalemprestado,
                COALESCE(
                    JSON_AGG(
                        DISTINCT jsonb_build_object(
                            'codigolivro', L.codigolivro,
                            'titulo', L.titulo,
                            'quantidadeemprestada', EL.quantidadeemprestada,
                            'quantidadedevolvida', EL.quantidadedevolvida,
                            'imagem', L.imagem,
                            'imagem_url',
                            CASE 
                                WHEN L.imagem IS NOT NULL
                                THEN 'https://ik.imagekit.io/bibliothek/LivrosImagens/' || L.imagem || '.png'
                                ELSE NULL
                            END,
                            'codigoemprestimo', EMP.codigoemprestimo
                        )
                    ) FILTER (WHERE L.codigolivro IS NOT NULL),
                    '[]'
                ) AS livros
            FROM EMPRESTIMO EMP
            JOIN PESSOA PES ON PES.CODIGOPESSOA = EMP.CODIGOPESSOA
            JOIN FUNCIONARIO FUN ON FUN.CODIGOFUNCIONARIO = EMP.CODIGOFUNCIONARIO
            LEFT JOIN EMPRESTIMO_LIVRO EL ON EL.CODIGOEMPRESTIMO = EMP.CODIGOEMPRESTIMO
            LEFT JOIN LIVRO L ON L.CODIGOLIVRO = EL.CODIGOLIVRO
        `;

        // -------------------------------
        // CONDIÇÕES
        // -------------------------------
        let whereConditions: string[] = [];
        let havingConditions: string[] = [];
        let data: any[] = [];
        let paramIndex = 1;

        // --- FILTROS NORMAIS (WHERE) ---
        if (codigopessoa) {
            const pessoas = Array.isArray(codigopessoa) ? codigopessoa : [codigopessoa];
            const placeholders = pessoas.map((_, i) => `$${paramIndex + i}`);
            whereConditions.push(`EMP.CODIGOPESSOA IN (${placeholders.join(',')})`);
            data.push(...pessoas);
            paramIndex += pessoas.length;
        }

        if (livro) {
            const livros = Array.isArray(livro) ? livro : [livro];
            const placeholders = livros.map((_, i) => `$${paramIndex + i}`);
            whereConditions.push(`EL.CODIGOLIVRO IN (${placeholders.join(',')})`);
            data.push(...livros);
            paramIndex += livros.length;
        }

        if (datainiciocriacao) {
            whereConditions.push(`EMP.DATAEMPRESTIMO::date >= $${paramIndex}`);
            data.push(datainiciocriacao);
            paramIndex++;
        }
        if (datafimcriacao) {
            whereConditions.push(`EMP.DATAEMPRESTIMO::date <= $${paramIndex}`);
            data.push(datafimcriacao);
            paramIndex++;
        }
        if (datainiciodevolucao) {
            whereConditions.push(`EMP.DATADEVOLUCAO::date >= $${paramIndex}`);
            data.push(datainiciodevolucao);
            paramIndex++;
        }
        if (datafimdevolucao) {
            whereConditions.push(`EMP.DATADEVOLUCAO::date <= $${paramIndex}`);
            data.push(datafimdevolucao);
            paramIndex++;
        }

        // --- FILTRO POR SITUAÇÃO (HAVING, pois depende de SUM) ---
        if (situacao) {
            const situacoes = Array.isArray(situacao) ? situacao : [situacao];
            const statusConditions: string[] = [];

            if (situacoes.includes('1')) { // Pendente
                statusConditions.push(`SUM(EL.QUANTIDADEDEVOLVIDA) < SUM(EL.QUANTIDADEEMPRESTADA)`);
            }
            if (situacoes.includes('0')) { // Atrasado
                statusConditions.push(`SUM(EL.QUANTIDADEDEVOLVIDA) < SUM(EL.QUANTIDADEEMPRESTADA) AND CURRENT_DATE > MAX(EMP.DATADEVOLUCAOPREVISTA)`);
            }
            if (situacoes.includes('2')) { // Devolvido
                statusConditions.push(`SUM(EL.QUANTIDADEDEVOLVIDA) = SUM(EL.QUANTIDADEEMPRESTADA)`);
            }

            if (statusConditions.length > 0) {
                havingConditions.push(`(${statusConditions.join(' OR ')})`);
            }
        }

        // -------------------------------
        // MONTAGEM FINAL DA QUERY
        // -------------------------------
        if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(' AND ')}`;
        }

        query += `
            GROUP BY EMP.CODIGOEMPRESTIMO, PES.CODIGOPESSOA, PES.NOME
        `;

        if (havingConditions.length > 0) {
            query += ` HAVING ${havingConditions.join(' OR ')}`;
        }

        query += ';';

        // -------------------------------
        // EXECUÇÃO
        // -------------------------------
        const { rows } = await pool.query(query, data);

        reply.status(200).send({ message: 'Emprestimo found successfully!', data: rows });
    } catch (err) {
        console.error(err);
        reply.status(500).send({ message: 'Emprestimo not found!', data: err });
    }
};


export const getExisteEmprestimoAberto = async(request: FastifyRequest, reply: FastifyReply) => {
    
    const { codigopessoa } = request.query as { codigopessoa?: number | string };
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');

    if(!token){
        return reply.code(401).send({ error: "Token not found!" });
    }

    const resp = await verifyJWT(token)
    if(!resp){
        return reply.code(401).send({ error: "Invalid JWT Token!" });
    }
    
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
    
    const emprestimo = request.body as any;
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');

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
            const queryLivros = "INSERT INTO EMPRESTIMO_LIVRO (CODIGOEMPRESTIMO, CODIGOLIVRO, QUANTIDADEEMPRESTADA, QUANTIDADEDEVOLVIDA) VALUES ($1, $2, $3, $4) RETURNING *";
            const dataLivros = [newEmprestimo[0].codigoemprestimo, livro.codigolivro, livro.quantidadeemprestada, livro.quantidadedevolvida]
            await pool.query(queryLivros, dataLivros);
        }

        await pool.query('COMMIT');
        const formtedEmprestimo = {
            ...emprestimo,
            ...newEmprestimo[0],
            codigoemprestimotemp: emprestimo.codigoemprestimo,
            sync: 0,
        }
 
        reply.status(200).send({ message: 'Emprestimo inserted successfully!', data:  formtedEmprestimo});
    }catch(err){
        await pool.query('ROLLBACK');
        console.log(err)
        reply.status(500).send({ message: 'Emprestimo not inserted!', data: err });
    }
}

export const devolveEmprestimo = async(request: FastifyRequest, reply: FastifyReply) => {
    const { emprestimo } = request.body as {emprestimo : any};
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');    
    
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
        console.log(err)
        reply.status(500).send({ message: 'Emprestimo not returned!', data: err });
    }
}

export const renovaEmprestimo = async(request: FastifyRequest, reply: FastifyReply) => {
    const { emprestimo } = request.body as {emprestimo : any};
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');   
        
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
    const {emprestimo} = request.body as any;
    const token = request.cookies.token || request.headers.authorization?.replace('Bearer ', '');
    
    if(!token){
        return reply.status(401).send({ message: 'Token not found!' });
    }
    const res = await verifyJWT(token);

    if(!res){
        return reply.status(401).send({ message: 'Expired section!', data: ''});
    }

    const funcionario = res.funcionario;
    if (funcionario.tipopessoa !== 2 || Number(funcionario.privilegio) !== 999) {
        return reply.status(401).send({ message: 'Você não tem permissão para deletar emprestimos!', data: ''});
    }

    try{
        await pool.query('BEGIN');
        const queryLivros = "DELETE FROM EMPRESTIMO_LIVRO WHERE CODIGOEMPRESTIMO = $1 RETURNING *";
        const dataLivros = [emprestimo.codigoemprestimo]
        const {rows: emprestimoLivros} = await pool.query(queryLivros, dataLivros);
        
        const query = "DELETE FROM EMPRESTIMO WHERE CODIGOEMPRESTIMO = $1 RETURNING *";
        const data = [emprestimo.codigoemprestimo]

        const {rows} = await pool.query(query, data);

        await pool.query('COMMIT');
        return reply.status(200).send({ message: 'Emprestimo deleted successfully!', data:  'sucess' });
    }catch(err){
        await pool.query('ROLLBACK');
        console.log(err)
        return reply.status(500).send({ message: 'Emprestimo not deleted!', data: err });
    }
}