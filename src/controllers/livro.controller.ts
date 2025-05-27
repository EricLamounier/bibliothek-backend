import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';
import { deleteImages, processAndUploadImage } from '../utils/imagekit';
import { MultipartFile } from '@fastify/multipart';

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
    editora_id: number;
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
                SELECT LA.*, A.NOME
                FROM LIVRO_AUTOR LA JOIN AUTOR A ON A.ID = LA.AUTOR_ID
                WHERE LIVRO_ID = $1
            `;
            const { rows: autores } = await pool.query(queryAutores, [livro.id]);
            
            return {
                ...livro,
                imagem: livro.imagem ? `https://ik.imagekit.io/bibliothek/LivrosImagens/${livro.imagem}.png` : null,
                autores: autores.map(autor => ({ id: autor.autor_id, nome: autor.nome, sync: 0 })),
            };
        }));

        //console.log(livrosComAutores)

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

export const postLivro = async(request: FastifyRequest, reply: FastifyReply) => {

    

    const { livro: livroField, image } = request.body as { livro: { value: string }, image?: MultipartFile };
    const token = request.cookies.token;

    console.log(livroField)

    return reply.status(200).send({ message: 'Livro inserted successfully!', data: [] });

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
            INSERT INTO LIVRO (TITULO, QUANTIDADETOTAL, QUANTIDADEDISPONIVEL, ISBN, EDICAO, LOCALIZACAO, QRCODE, OBSERVACAO, EDITORA_ID, IMAGEM)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
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
            livro.observacao.slice(0, 100),
            livro.editora_id,
            imageUrl
        ];
        
        const { rows: [insertedBook] } = await pool.query(queryLivro, dataLivro);

        interface AutorInfo {
            id: number;
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
                    'INSERT INTO LIVRO_AUTOR (AUTOR_ID, LIVRO_ID) VALUES ($1, $2)',
                    [autor.id, insertedBook.id]
                );
            }
        }

        const responseData = {
            id: insertedBook.id,
            titulo: insertedBook.titulo,
            autores: autoresInfo.map(autor => ({
                id: autor.id,
                nome: autor.nome,
                observacao: autor.observacao,
                sync: 0
            })),
            editora_id: insertedBook.editora_id,
            edicao: insertedBook.edicao,
            isbn: insertedBook.isbn,
            quantidadetotal: insertedBook.quantidadetotal,
            quantidadedisponivel: insertedBook.quantidadedisponivel,
            localizacao: insertedBook.localizacao,
            observacao: insertedBook.observacao,
            situacao: insertedBook.situacao || 0,
            imagem: imageUrl ? `https://ik.imagekit.io/bibliothek/LivrosImagens/${imageUrl}.png` : null
        };

        console.log(responseData)

        await pool.query('COMMIT');
        reply.status(200).send({ message: 'Livro inserted successfully!', data: responseData });

    } catch(err) {
        await pool.query('ROLLBACK');
        console.log(err)
        imageUrl && await deleteImage(imageUrl)
        reply.status(500).send({ message: 'Livro not inserted!', data: err });
    }
}

export const putLivro = async (request: FastifyRequest, reply: FastifyReply) => {
    const { livro: livroField, image } = request.body as { livro: { value: string }, image?: MultipartFile };
    const token = request.cookies.token;

    const livro = JSON.parse(livroField.value);
    console.log(livro)

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

        const queryImagem = 'SELECT IMAGEM FROM LIVRO WHERE ID = $1 LIMIT 1';
        const { rows: [imagemBDId] } = await pool.query(queryImagem, [livro.id]);

        let imagemUrl = null;
        let imageID = null;
        if(image){ // Imagem foi enviada
            if (imagemBDId.imagem) await deleteImage(imagemBDId.imagem);

            // Envio nova imagem
            imageID = await processAndUploadImage(image, '/LivrosImagens');

            // Crio URL com a nova imagem
            imagemUrl = `https://ik.imagekit.io/bibliothek/LivrosImagens/${imageID}.png`


        }else{ // Imagem não foi enviada

            if(livro.imageChanged == 2) { // Imagem prévia removida
                // Remove imagem do banco e deleta do ImageKit
                if(imagemBDId.imagem){ // tem imagem no banco
                    const queryImagem = 'UPDATE LIVRO SET IMAGEM = $1 WHERE ID = $2';
                    await pool.query(queryImagem, [null, livro.id]);
                    await deleteImage(imagemBDId.imagem);
                }
            }else{ // Não alterou a imagem prévia
                imagemUrl = imagemBDId.imagem ? `https://ik.imagekit.io/bibliothek/LivrosImagens/${imagemBDId.imagem}.png` : null;
            }
        }

        const dataLivro = [
            livro.titulo,
            livro.quantidadetotal,
            livro.isbn,
            livro.edicao,
            livro.localizacao,
            livro.observacao.slice(0, 100),
            livro.editora_id,
            livro.situacao,
            imageID,
            livro.id,
        ];

        const queryLivro = `
            UPDATE LIVRO
            SET TITULO = $1,
                QUANTIDADETOTAL = $2,
                ISBN = $3,
                EDICAO = $4,
                LOCALIZACAO = $5,
                OBSERVACAO = $6,
                EDITORA_ID = $7,
                SITUACAO = $8,
                IMAGEM = COALESCE($9, IMAGEM)             
            WHERE ID = $10
            RETURNING *
        `;
        const { rows } = await pool.query(queryLivro, dataLivro);

        // Update author relationships
        if (livro.autores && livro.autores.length > 0) {
            const queryInsertAutorLivro = `
                INSERT INTO LIVRO_AUTOR (AUTOR_ID, LIVRO_ID)
                VALUES ($1, $2)
            `;

            const queryDeleteAutorLivro = `
                DELETE FROM LIVRO_AUTOR
                WHERE LIVRO_ID = $1 AND AUTOR_ID = $2
            `;

            for (const autor of livro.autores) {

                // Insere novo autor
                if(autor.sync === 1){
                    await pool.query(queryInsertAutorLivro, [autor.id, livro.id]);
                }

                // Exclui autor
                if(autor.sync === 2){
                    await pool.query(queryDeleteAutorLivro, [livro.id, autor.id]);
                }
            }
        }

        const updatedLivro = {
            ...rows[0],
            autores: livro.autores = livro.autores
                .filter((autor: any) => autor.sync !== 2)
                .map((autor: any) => ({ ...autor, sync: 0 })),
            imagem: imagemUrl
        }

        console.log(updatedLivro)
        await pool.query('COMMIT');
        
        reply.status(200).send({ message: 'Livro updated successfully!', data:  updatedLivro});

    }catch(err){
        await pool.query('ROLLBACK');
        reply.status(500).send({ message: 'Livro not updated!', data: err, errorMessage: err?.message });
    }
};

export const deleteLivro = async (request: FastifyRequest, reply: FastifyReply) => {
    const { livroID } = request.body as {livroID : number[]};
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
        const placeholders = livroID.map((_, index) => `$${index + 1}`).join(", ");

        const data = livroID;

        const queryImagem = `SELECT IMAGEM FROM LIVRO WHERE ID IN (${placeholders})`;
        const { rows } = await pool.query(queryImagem, data);

        const queryLivroAutor = `DELETE FROM LIVRO_AUTOR WHERE LIVRO_ID IN (${placeholders})`;
        await pool.query(queryLivroAutor, data);

        const queryLivro = `DELETE FROM LIVRO WHERE ID IN (${placeholders})`;
        await pool.query(queryLivro, data);        

        await pool.query('COMMIT');

        const imagens = rows.map((row: any) => row.imagem);

        deleteImages(imagens);

        reply.status(200).send({ message: 'Livro deleted successfully!', data:  'suces'});
    }catch(err){
        await pool.query('ROLLBACK');
        reply.status(200).send({ message: 'Livro not deleted!', data: err });
    }


};