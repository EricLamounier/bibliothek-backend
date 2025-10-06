import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';
import { deleteImages, processAndUploadImage } from '../utils/imagekit';
import { MultipartFile } from '@fastify/multipart';

export const getLivro = async (request: FastifyRequest, reply: FastifyReply) => {
    const { codigolivro, autor, editora, disponibilidade, situacao } = request.query as { codigolivro?: number[], autor?: number[], editora?: number[], disponibilidade?: string[], situacao?: string[] };
    const token = request.cookies.token
    
    if(!token){
        return reply.status(401).send({ message: 'Token not found!' });
    }
    
    const res = await verifyJWT(token);
    
    if(!res){
        return reply.status(401).send({ message: 'Expired section!', data: ''});
    }
    
    try {
        let queryLivros = `
            SELECT DISTINCT l.*, e.NOME AS NOMEEDITORA
            FROM LIVRO l
            JOIN EDITORA e ON l.CODIGOEDITORA = e.CODIGOEDITORA
        `;
        
        if (autor) {
            queryLivros += `
                JOIN LIVRO_AUTOR LA ON l.CODIGOLIVRO = LA.CODIGOLIVRO
            `;
        }

        const params: any[] = [];
        const conditions: string[] = [];
        let paramIndex = 1;

        if (codigolivro) {
            const livros = Array.isArray(codigolivro) ? codigolivro : [codigolivro]
            const placeholders = livros.map((_, i) => `$${paramIndex + i}`)
            conditions.push(`l.CODIGOLIVRO IN (${placeholders.join(',')})`)
            params.push(...livros)
            paramIndex += livros.length
        }

        if (autor) {
            const autores = Array.isArray(autor) ? autor : [autor]
            const placeholders = autores.map((_, i) => `$${paramIndex + i}`)
            conditions.push(`LA.CODIGOAUTOR IN (${placeholders.join(',')})`)
            params.push(...autores)
            paramIndex += autores.length
        }

        if (editora) {
            const editoras = Array.isArray(editora) ? editora : [editora]
            const placeholders = editoras.map((_, i) => `$${paramIndex + i}`)
            conditions.push(`l.CODIGOEDITORA IN (${placeholders.join(',')})`)
            params.push(...editoras)
            paramIndex += editoras.length
        }

        if (situacao) {
            const situacoes = Array.isArray(situacao) ? situacao : [situacao]
            const placeholders = situacoes.map((_, i) => `$${paramIndex + i}`)
            conditions.push(`l.SITUACAO IN (${placeholders.join(',')})`)
            params.push(...situacoes)
            paramIndex += situacoes.length
        }

        if (disponibilidade) {
            const disponiveis = Array.isArray(disponibilidade) ? disponibilidade : [disponibilidade]
            if(disponibilidade.length == 1){               
                if(disponiveis.includes('1')){
                    conditions.push(`l.QUANTIDADEDISPONIVEL > 0`)
                }else if(disponiveis.includes('0')){
                    conditions.push(`l.QUANTIDADEDISPONIVEL <= 0`)
                }
            }
        }

        if (conditions.length > 0) {
            queryLivros += ' WHERE ' + conditions.join(' AND ');
        }

        const { rows: livros } = await pool.query(queryLivros, params);

        const livrosComAutores = await Promise.all(livros.map(async (livro : any) => {
            const queryAutores = `
                SELECT LA.*, A.NOME
                FROM LIVRO_AUTOR LA JOIN AUTOR A ON A.CODIGOAUTOR = LA.CODIGOAUTOR
                WHERE CODIGOLIVRO = $1
            `;
            const { rows: autores } = await pool.query(queryAutores, [livro.codigolivro]);
            
            return {
                ...livro,
                autores: autores.map((autor : any) => ({ codigoautor: autor.codigoautor, nome: autor.nome, sync: 0 })),
            };
        }));

        reply.status(200).send({ 
            message: 'Livros fetched successfully!', 
            data: livrosComAutores 
        });
    } catch (err) {
        console.log(err)
        reply.status(500).send({ 
            message: 'Error fetching livros!', 
            data: err 
        });
    }
};

export const postLivro = async(request: FastifyRequest, reply: FastifyReply) => {

    const { livro: livroField, image } = request.body as { livro: { value: string }, image?: MultipartFile };
    const token = request.cookies.token;

    const livro = JSON.parse(livroField.value);
    let imageUrl = null

    try {
        if (!livro.titulo) {
            return reply.status(400).send({ message: "Livro's name required!" });
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        if (image) {
            try {
                imageUrl = await processAndUploadImage(image, '/LivrosImagens');
            } catch (err) {
                return reply.status(500).send({ message: 'Failed to upload image', error: err });
            }
        }

        await pool.query('BEGIN');

        // Insert query with image URL
        const queryLivro = `
            INSERT INTO LIVRO (TITULO, QUANTIDADETOTAL, QUANTIDADEDISPONIVEL, ISBN, EDICAO, LOCALIZACAO, OBSERVACAO, CODIGOEDITORA, IMAGEM)
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
            livro.observacao.slice(0, 100),
            livro.codigoeditora,
            imageUrl
        ];
        
        const { rows: [insertedBook] } = await pool.query(queryLivro, dataLivro);

        interface AutorInfo {
            codigoautor: number;
            nome: string;
            observacao: string;
        }

        const autoresInfo: AutorInfo[] = [];

        // Insert author relationships and get author info
        if (livro.autores && livro.autores.length > 0) {
            for (const autor of livro.autores) {  
                autoresInfo.push(autor);
                // Then create the relationship
                await pool.query(
                    'INSERT INTO LIVRO_AUTOR (CODIGOAUTOR, CODIGOLIVRO) VALUES ($1, $2)',
                    [autor.codigoautor, insertedBook.codigolivro]
                );
            }
        }

        const responseData = {
            codigolivro: insertedBook.codigolivro,
            titulo: insertedBook.titulo,
            autores: autoresInfo.map(autor => ({
                codigoautor: autor.codigoautor,
                nome: autor.nome,
                observacao: autor.observacao,
                sync: 0
            })),
            codigoeditora: insertedBook.codigoeditora,
            edicao: insertedBook.edicao,
            isbn: insertedBook.isbn,
            quantidadetotal: insertedBook.quantidadetotal,
            quantidadedisponivel: insertedBook.quantidadedisponivel,
            localizacao: insertedBook.localizacao,
            observacao: insertedBook.observacao,
            situacao: insertedBook.situacao || 0,
            imagem: imageUrl,
            sync: 0,
            codigolivrotemp: livro.codigolivro
        };

        await pool.query('COMMIT');
        reply.status(200).send({ message: 'Livro inserted successfully!', data: responseData });

    } catch(err : any) {
        await pool.query('ROLLBACK');
        console.log(err)
        imageUrl && await deleteImages([imageUrl])
        reply.status(500).send({ message: 'Livro not inserted!', data: err, errorMessage: err?.message });
    }
}

export const putLivro = async (request: FastifyRequest, reply: FastifyReply) => {
    const { livro: livroField, image } = request.body as { livro: { value: string }, image?: MultipartFile };
    const token = request.cookies.token;

    const livro = JSON.parse(livroField.value);
    try{
        if(!livro){
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

        const queryImagem = 'SELECT IMAGEM FROM LIVRO WHERE CODIGOLIVRO = $1 LIMIT 1';
        const { rows: [imagemBDId] } = await pool.query(queryImagem, [livro.codigolivro]);

        let imagemUrl = null;
        let imageID = null;
        if(image){ // Imagem foi enviada
            if (imagemBDId.imagem) await deleteImages([imagemBDId.imagem]);

            // Envio nova imagem
            imageID = await processAndUploadImage(image, '/LivrosImagens');

            // Crio URL com a nova imagem
            imagemUrl = imageID


        }else{ // Imagem não foi enviada

            if(livro.imageChanged == 2) { // Imagem prévia removida
                // Remove imagem do banco e deleta do ImageKit
                if(imagemBDId.imagem){ // tem imagem no banco
                    const queryImagem = 'UPDATE LIVRO SET IMAGEM = $1 WHERE CODIGOLIVRO = $2';
                    await pool.query(queryImagem, [null, livro.codigolivro]);
                    await deleteImages([imagemBDId.imagem]);
                }
            }else{ // Não alterou a imagem prévia
                imagemUrl = imagemBDId.imagem;
            }
        }

        const dataLivro = [
            livro.titulo,
            livro.quantidadetotal,
            livro.isbn,
            livro.edicao,
            livro.localizacao,
            livro.observacao.slice(0, 100),
            livro.codigoeditora,
            livro.situacao,
            imageID,
            livro.codigolivro,
        ];

        const queryLivro = `
            UPDATE LIVRO
            SET TITULO = $1,
                QUANTIDADETOTAL = $2,
                ISBN = $3,
                EDICAO = $4,
                LOCALIZACAO = $5,
                OBSERVACAO = $6,
                CODIGOEDITORA = $7,
                SITUACAO = $8,
                IMAGEM = COALESCE($9, IMAGEM)
            WHERE CODIGOLIVRO = $10
            RETURNING *
        `;
        const { rows } = await pool.query(queryLivro, dataLivro);

        // Update author relationships
        if (livro.autores && livro.autores.length > 0) {
            const queryInsertAutorLivro = `
                INSERT INTO LIVRO_AUTOR (CODIGOAUTOR, CODIGOLIVRO)
                VALUES ($1, $2)
            `;

            const queryDeleteAutorLivro = `
                DELETE FROM LIVRO_AUTOR
                WHERE CODIGOLIVRO = $1 AND CODIGOAUTOR = $2
            `;

            for (const autor of livro.autores) {

                // Insere novo autor
                if(autor.sync === 1){
                    await pool.query(queryInsertAutorLivro, [autor.codigoautor, livro.codigolivro]);
                }

                // Exclui autor
                if(autor.sync === 2){
                    await pool.query(queryDeleteAutorLivro, [livro.codigolivro, autor.codigoautor]);
                }
            }
        }

        const updatedLivro = {
            ...rows[0],
            autores: livro.autores = livro.autores
                .filter((autor: any) => autor.sync !== 2)
                .map((autor: any) => ({ ...autor, sync: 0 })),
            imagem: imagemUrl,
            sync: 0,
        }

        await pool.query('COMMIT');
        
        reply.status(200).send({ message: 'Livro updated successfully!', data:  updatedLivro});

    }catch(err : any){
        await pool.query('ROLLBACK');
        reply.status(500).send({ message: 'Livro not updated!', data: err, errorMessage: err?.message });
    }
};

export const deleteLivro = async (request: FastifyRequest, reply: FastifyReply) => {
    const { livro } = request.body as any;
    const token = request.cookies.token;

    try{
        if(!livro){
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

        const data = [livro.codigolivro];

        const queryImagem = `SELECT IMAGEM FROM LIVRO WHERE CODIGOLIVRO IN ($1)`;
        const { rows } = await pool.query(queryImagem, data);

        const queryLivroAutor = `DELETE FROM LIVRO_AUTOR WHERE CODIGOLIVRO IN ($1)`;
        await pool.query(queryLivroAutor, data);

        const queryLivro = `DELETE FROM LIVRO WHERE CODIGOLIVRO IN ($1)`;
        await pool.query(queryLivro, data);        

        await pool.query('COMMIT');

        const imagens = rows.map((row: any) => row.imagem);

        deleteImages(imagens);

        reply.status(200).send({ message: 'Livro deleted successfully!', data:  'success'});
    }catch(err : any){
        await pool.query('ROLLBACK');
        reply.status(500).send({ message: 'Livro not deleted!', data: err, errorMessage: err?.message });
    }


};