import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';

interface LivroProps {
    id?: number;
    titulo: string;
    autores: {id: number, sync: number}[];
    editora: string;
    edicao: string;
    isbn: string;
    genero: string;
    dataPublicacao: string;
    quantidadetotal: number;
    quantidadedisponivel: number;
    localizacao: string;
    observacao: string;
    situacao: number;
    editoraId: number;
};

export const postLivro = async(request: FastifyRequest, reply: FastifyReply) => {
    const livro = request.body as LivroProps;
    const token = request.cookies.token;

    console.log(livro)

    try {
        if (!livro.titulo) {
            return reply.status(400).send({ message: "Livro's name required!" });
        }

        if(!token){
            //return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            //return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');

        // Insert the book first
        const queryLivro = `
            INSERT INTO LIVRO (TITULO, QUANTIDADETOTAL, QUANTIDADEDISPONIVEL, ISBN, EDICAO, LOCALIZACAO, QRCODE, OBSERVACAO, EDITORA_ID)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
            RETURNING *
        `;
        const dataLivro = [
            livro.titulo,
            livro.quantidadetotal,
            livro.quantidadetotal,
            livro.isbn,
            livro.edicao,
            livro.localizacao,
            'QRCODE',
            livro.observacao,
            livro.editoraId
        ];

        
        const { rows: [insertedBook] } = await pool.query(queryLivro, dataLivro);

        // Insert author relationships
        if (livro.autores && livro.autores.length > 0) {
            const queryAutorLivro = `
                INSERT INTO LIVRO_AUTOR (AUTOR_ID, LIVRO_ID)
                VALUES ($1, $2)
            `;

            for (const autor of livro.autores) {
                await pool.query(queryAutorLivro, [autor.id, insertedBook.id]);
            }
        }

        await pool.query('COMMIT');
        reply.status(200).send({ message: 'Livro inserted successfully!', data: 'insertedBook' });

    } catch(err) {
        await pool.query('ROLLBACK');
        reply.status(500).send({ message: 'Livro not inserted!', data: err });
    }
};

interface LivrosPropsGet extends LivroProps {
    'IDs[]': number[];
};

export const getLivro = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        // First get all books
        const queryLivros = `
            SELECT l.* 
            FROM LIVRO l
        `;
        const { rows: livros } = await pool.query(queryLivros);

        // For each book, get its authors
        const livrosComAutores = await Promise.all(livros.map(async (livro) => {
            const queryAutores = `
                SELECT AUTOR_ID 
                FROM LIVRO_AUTOR 
                WHERE LIVRO_ID = $1
            `;
            const { rows: autores } = await pool.query(queryAutores, [livro.id]);
            
            return {
                ...livro,
                autores: autores.map(autor => ({ id: autor.autor_id, sync: 0 }))
            };
        }));

        reply.status(200).send({ 
            message: 'Livros fetched successfully!', 
            data: livrosComAutores 
        });
    } catch (err) {
        reply.status(500).send({ 
            message: 'Error fetching livros!', 
            data: err 
        });
    }
};

export const deleteLivro = async (request: FastifyRequest, reply: FastifyReply) => {
    const { livroID } = request.query as {livroID : number};
    const token = request.cookies.token;

    try{
        if(!livroID){
            return reply.status(400).send({ message: "Livro's ID required!" })
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');
        const data = [livroID];
        const query = 'DELETE FROM LIVRO WHERE ID = $1';
        const { rows } = await pool.query(query, data);
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Livro deleted successfully!', data:  rows[0]});
    }catch(err){
        reply.status(200).send({ message: 'Livro not deleted!', data: err });
    }


};

export const putLivro = async (request: FastifyRequest, reply: FastifyReply) => {
    const { livroID, nome, observacao, situacao } = request.body as {livroID : number, nome: string, observacao : string, situacao : number};
    const token = request.cookies.token;

    try{
        if(!livroID){
            return reply.status(400).send({ message: "Livro's ID required!" });
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');
        const data = [nome, observacao, situacao, livroID];
        const query = 'UPDATE LIVRO SET NOME = $1, OBSERVACAO = $2, SITUACAO = $3 WHERE ID = $4';
        const { rows } = await pool.query(query, data);
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Livro updated successfully!', data:  rows[0]});

    }catch(err){
        reply.status(200).send({ message: 'Livro not updated!', data: err });
    }
};