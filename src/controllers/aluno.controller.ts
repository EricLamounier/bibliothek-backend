import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT } from '../utils/jwt';
import { deleteImage, processAndUploadImage } from '../utils/imagekit';
import { MultipartFile } from '@fastify/multipart';

interface AlunoProps {
    userID: number | string;
    nome: string;
    observacao?: string;
};

export const getAluno = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = `SELECT 
                    AL.ID AS id,
                    PES.*,
                    PES.TIPO AS pessoa_tipo,
                    PES.ID AS pessoa_id,
                    AL.ID AS aluno_id,
                    AL.MATRICULA,
                    AL.DATA_MATRICULA AS datamatricula,
                    AL.VENCIMENTO_CARTEIRINHA AS datavencimento
                    FROM PESSOA PES
                    JOIN ALUNO AL ON PES.ID = AL.PESSOA_ID
                    WHERE PES.TIPO = 0
                    GROUP BY PES.ID, PES.NOME, PES.CONTATO, AL.ID;
                    `;

    const { rows : alunos } = await pool.query(query);
    const formatedAlunos = await Promise.all(alunos.map(async (aluno) => {
        return {
            ...aluno,
            imagem: aluno.imagem ? `https://ik.imagekit.io/bibliothek/PessoasImagens/${aluno.imagem}.png` : null,
        }
    }))

    reply.status(200).send({ message: 'Alunos fetched successfully!', data: formatedAlunos });
};

export const postAluno = async(request: FastifyRequest, reply: FastifyReply) => {
    
    const token = request.cookies.token;

    const { aluno: alunoField, image } = request.body as { aluno: { value: string }, image?: MultipartFile };
    const aluno = JSON.parse(alunoField.value);   

    let imageUrl = null
    try{
        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        if (image) {
            try {
                imageUrl = await processAndUploadImage(image, '/PessoasImagens');
            } catch (err) {
                console.log(err)
                return reply.status(500).send({ message: 'Failed to upload image', error: err });
            }
        }

        await pool.query('BEGIN');
        
        const dataPessoa = [aluno.nome, aluno.contato, aluno.observacao, imageUrl, 0];
        const queryPessoa = `INSERT INTO PESSOA (NOME, CONTATO, OBSERVACAO, IMAGEM, TIPO)
                            VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        const {rows: [pessoaRow]} = await pool.query(queryPessoa, dataPessoa);

        const queryAluno = "INSERT INTO ALUNO (MATRICULA, DATA_MATRICULA, VENCIMENTO_CARTEIRINHA, PESSOA_ID) VALUES ($1, $2, $3, $4) RETURNING *";
        const data = [aluno.matricula, aluno.datamatricula, aluno.datavencimento, pessoaRow.id]
        const {rows: [alunoRow]} = await pool.query(queryAluno, data);

        await pool.query('COMMIT');

        const createdData = {
            ...aluno,
            id: alunoRow.id,
            pessoa_id: pessoaRow.id,
            imagem: imageUrl ? `https://ik.imagekit.io/bibliothek/PessoasImagens/${imageUrl}.png` : null,
            situacao: 1
        }
 
        reply.status(200).send({ message: 'Aluno inserted successfully!', data:  createdData});
    }catch(err){
        console.log(err)
        imageUrl && await deleteImage(imageUrl)
        reply.status(500).send({ message: 'Aluno not inserted!', data: err });
    }
};

export const putAluno = async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies.token;

    const { aluno: alunoField, image } = request.body as { aluno: { value: string }, image?: MultipartFile };
    const aluno = JSON.parse(alunoField.value);

    console.log(aluno)

    try{

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        let imagemUrl = null;
        let imageID = null;
        const queryImagem = 'SELECT IMAGEM FROM PESSOA WHERE ID = $1 LIMIT 1';
        const { rows: [imagemBDId] } = await pool.query(queryImagem, [aluno.pessoa_id]);

        if(image){ // Imagem foi enviada
            if (imagemBDId.imagem) await deleteImage(imagemBDId.imagem);

            // Envio nova imagem
            imageID = await processAndUploadImage(image, '/PessoasImagens');

            // Crio URL com a nova imagem
            imagemUrl = `https://ik.imagekit.io/bibliothek/PessoasImagens/${imageID}.png`


        }else{ // Imagem não foi enviada

            if(aluno.imageChanged == 2) { // Imagem prévia removida
                // Remove imagem do banco e deleta do ImageKit
                if(imagemBDId.imagem){ // tem imagem no banco
                    const queryImagem = 'UPDATE PESSOA SET IMAGEM = $1 WHERE ID = $2';
                    await pool.query(queryImagem, [null, aluno.id]);
                    await deleteImage(imagemBDId.imagem);
                }
            }else{ // Não alterou a imagem prévia
                console.log(imagemBDId)
                imagemUrl = imagemBDId.imagem ? `https://ik.imagekit.io/bibliothek/PessoasImagens/${imagemBDId.imagem}.png` : null;
            }
        }

        await pool.query('BEGIN');
        const queryPessoa = "UPDATE PESSOA SET NOME = $1, CONTATO = $2, IMAGEM = COALESCE($3, IMAGEM), OBSERVACAO = $4, SITUACAO = $5 WHERE ID = $6";
        const data = [aluno.nome, aluno.contato, imageID, aluno.observacao, aluno.situacao, aluno.pessoa_id];
        await pool.query(queryPessoa, data);

        const queryAluno = `UPDATE ALUNO 
                            SET MATRICULA = $1, 
                                VENCIMENTO_CARTEIRINHA = $2,
                                DATA_MATRICULA = $3
                            WHERE PESSOA_ID = $4
                            `;
        const dataAluno = [aluno.matricula, aluno.datavencimento, aluno.datamatricula, aluno.id];
        await pool.query(queryAluno, dataAluno);

        const updatedAluno = {
            ...aluno,
            imagem: imagemUrl
        }

        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Aluno updated successfully!', data:  updatedAluno});
    }catch(err){
        console.log(err)
        reply.status(500).send({ message: 'Aluno not updated!', data: err });
    }
};

export const deleteAluno = async (request: FastifyRequest, reply: FastifyReply) => {
    const { pessoaID } = request.query as {pessoaID : number};
    const token = request.cookies.token;

    try{
        if(!pessoaID){
            return reply.status(400).send({ message: "Aluno's ID required!" })
        }

        if(!token){
            return reply.status(401).send({ message: 'Token not found!' });
        }

        const res = await verifyJWT(token);

        if(!res){
            return reply.status(401).send({ message: 'Expired section!', data: ''});
        }

        await pool.query('BEGIN');

        const data = [pessoaID];

        const queryImagem = 'SELECT IMAGEM FROM PESSOA WHERE ID = $1 LIMIT 1';
        const { rows: [imagemId] } = await pool.query(queryImagem, data);

        const queryAluno = 'DELETE FROM ALUNO WHERE PESSOA_ID = $1';
        const queryPessoa = 'DELETE FROM PESSOA WHERE ID = $1';
        
        await pool.query(queryAluno, data);
        await pool.query(queryPessoa, data);

        imagemId.imagem && await deleteImage(imagemId.imagem)

        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Aluno deleted successfully!', data:  pessoaID});
    }catch(err){
        reply.status(200).send({ message: 'Aluno not deleted!', data: err });
    }
};