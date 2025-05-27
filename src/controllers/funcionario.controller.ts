import { FastifyReply, FastifyRequest } from 'fastify';
import pool from '../config/db';
import { verifyJWT, hashPassword } from '../utils/jwt';
import { sendEmails, generateTempPassword } from '../utils/gmail';
import { deleteImage, processAndUploadImage } from '../utils/imagekit';
import { MultipartFile } from '@fastify/multipart';

interface FuncionarioProps {
    userID: number | string;
    nome: string;
    observacao?: string;
};

export const getFuncionario = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = `SELECT 
                    FUN.ID AS ID,
                    PES.ID AS pessoa_id,
                    PES.NOME,
                    PES.CONTATO,
                    PES.IMAGEM,
                    PES.TIPO,
                    PES.OBSERVACAO,
                    PES.SITUACAO,
                    FUN.USUARIO,
                    FUN.EMAIL,
                    FUN.DATAADMISSAO,
                    FUN.PRIVILEGIO	
                FROM PESSOA PES JOIN FUNCIONARIO FUN ON PES.ID = FUN.PESSOA_ID
                WHERE PES.TIPO = 2;
                    `;

    const { rows : funcionarios } = await pool.query(query);
    console.log(funcionarios)
    const formatedFuncionarios = await Promise.all(funcionarios.map(async (funcionario) => {
        return {
            ...funcionario,
            imagem: funcionario.imagem ? `https://ik.imagekit.io/bibliothek/PessoasImagens/${funcionario.imagem}.png` : null,
        }
    }))

    console.log(formatedFuncionarios)

    reply.status(200).send({ message: 'Funcionarios fetched successfully!', data: formatedFuncionarios });
};

export const postFuncionario = async(request: FastifyRequest, reply: FastifyReply) => {
    
    const token = request.cookies.token;

    const { funcionario: funcionarioField, image } = request.body as { funcionario: { value: string }, image?: MultipartFile };
    const funcionario = JSON.parse(funcionarioField.value);

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
        
        const dataPessoa = [funcionario.nome, funcionario.contato, funcionario.observacao, imageUrl, 2];
        const queryPessoa = `INSERT INTO PESSOA (NOME, CONTATO, OBSERVACAO, IMAGEM, TIPO)
                            VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        const {rows: [pessoaRow]} = await pool.query(queryPessoa, dataPessoa);

        // Pega senha temporaria
        const tempPassword = "000"//generateTempPassword()
        const hashedPassword = await hashPassword(tempPassword)

        console.log(tempPassword, hashedPassword)

        const queryFuncionario = "INSERT INTO FUNCIONARIO (USUARIO, EMAIL, DATAADMISSAO, PRIVILEGIO, SENHA, PESSOA_ID) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *";
        const data = [funcionario.usuario, funcionario.email, funcionario.dataadmissao, funcionario.privilegio, hashedPassword, pessoaRow.id]
        const {rows: [funcionarioRow]} = await pool.query(queryFuncionario, data);

        await pool.query('COMMIT');

        const createdData = {
            ...funcionario,
            id: funcionarioRow.id,
            pessoa_id: pessoaRow.id,
            imagem: imageUrl ? `https://ik.imagekit.io/bibliothek/PessoasImagens/${imageUrl}.png` : null,
            situacao: 1
        }

        console.log(createdData)

        sendEmails(funcionario.usuario, funcionario.email, tempPassword);
 
        reply.status(200).send({ message: 'Funcionario inserted successfully!', data:  createdData});
    }catch(err){
        console.log(err)
        imageUrl && await deleteImage(imageUrl)
        reply.status(500).send({ message: 'Funcionario not inserted!', data: err });
    }
};

export const putFuncionario = async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies.token;
    console.clear()

    const { funcionario: funcionarioField, image } = request.body as { funcionario: { value: string }, image?: MultipartFile };
    const funcionario = JSON.parse(funcionarioField.value);

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
        const { rows: [imagemBDId] } = await pool.query(queryImagem, [funcionario.pessoa_id]);

        if(image){ // Imagem foi enviada
            if (imagemBDId.imagem) await deleteImage(imagemBDId.imagem);

            // Envio nova imagem
            imageID = await processAndUploadImage(image, '/PessoasImagens');

            // Crio URL com a nova imagem
            imagemUrl = `https://ik.imagekit.io/bibliothek/PessoasImagens/${imageID}.png`

        }else{ // Imagem não foi enviada
            if(funcionario.imageChanged == 2) { // Imagem prévia removida
                // Remove imagem do banco e deleta do ImageKit
                if(imagemBDId.imagem){ // tem imagem no banco
                    const queryImagem = 'UPDATE PESSOA SET IMAGEM = $1 WHERE ID = $2';
                    await pool.query(queryImagem, [null, funcionario.id]);
                    await deleteImage(imagemBDId.imagem);
                }
            }else{ // Não alterou a imagem prévia
                imagemUrl = imagemBDId.imagem ? `https://ik.imagekit.io/bibliothek/PessoasImagens/${imagemBDId.imagem}.png` : null;
            }
        }

        await pool.query('BEGIN');
        const queryPessoa = "UPDATE PESSOA SET NOME = $1, CONTATO = $2, IMAGEM = COALESCE($3, IMAGEM), OBSERVACAO = $4, SITUACAO = $5 WHERE ID = $6";
        const data = [funcionario.nome, funcionario.contato, imageID, funcionario.observacao, funcionario.situacao, funcionario.pessoa_id];
        await pool.query(queryPessoa, data);

        const queryFuncionario = `UPDATE FUNCIONARIO 
                                    SET USUARIO = $1,
                                        EMAIL = $2,
                                        PRIVILEGIO = $3,
                                        DATAADMISSAO = $4
                                    WHERE ID = $5
                            `;
        const dataFuncionario = [funcionario.usuario, funcionario.email, funcionario.privilegio, funcionario.dataadmissao, funcionario.id];
        await pool.query(queryFuncionario, dataFuncionario);

        const updatedFuncionario = {
            ...funcionario,
            imagem: imagemUrl
        }

        console.log(updatedFuncionario)

        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Funcionario updated successfully!', data:  updatedFuncionario});
    }catch(err){
        console.log(err)
        reply.status(500).send({ message: 'Funcionario not updated!', data: err });
    }
};

export const resetSenhaFuncionario = async (request: FastifyRequest, reply: FastifyReply) => {
    const { funcionario} = request.body 

    console.log(funcionario)

    try{

        const tempPassword = generateTempPassword()
        const hashedPassword = await hashPassword(tempPassword)

        await pool.query('BEGIN');

        const queryFuncionario = `UPDATE FUNCIONARIO 
                                    SET SENHA = $1
                                    WHERE EMAIL = $2 RETURNING *
                            `;
        const dataFuncionario = [hashedPassword, funcionario.email];
        const {rows: [funcionarioRow]} = await pool.query(queryFuncionario, dataFuncionario);
        
        console.log(funcionarioRow, funcionarioRow.usuario)
        await sendEmails(funcionarioRow.usuario, funcionarioRow.email, tempPassword);

        reply.status(200).send({ message: 'Funcionario updated successfully!', data:  funcionario});
        await pool.query('COMMIT');
    }catch(err){
        console.log(err)
        await pool.query('ROLLBACK');
        reply.status(500).send({ message: 'Funcionario not updated!', data: err });
    }
};

export const deleteFuncionario = async (request: FastifyRequest, reply: FastifyReply) => {
    const { pessoaID } = request.query as {pessoaID : number};
    const token = request.cookies.token;

    console.log(pessoaID)

    try{
        if(!pessoaID){
            return reply.status(400).send({ message: "Funcionario's ID required!" })
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

        const queryFuncionario = 'DELETE FROM FUNCIONARIO WHERE PESSOA_ID = $1';
        const queryPessoa = 'DELETE FROM PESSOA WHERE ID = $1';
        
        await pool.query(queryFuncionario, data);
        await pool.query(queryPessoa, data);

        imagemId.imagem && await deleteImage(imagemId.imagem)

        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Funcionario deleted successfully!', data:  rows[0]});
    }catch(err){
        reply.status(200).send({ message: 'Funcionario not deleted!', data: err });
    }
};