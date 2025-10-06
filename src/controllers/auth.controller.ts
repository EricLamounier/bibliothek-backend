import { FastifyReply, FastifyRequest } from 'fastify';
import dotenv from 'dotenv';
import pool from '../config/db';
import { comparePassword, createJWT, hashPassword, verifyJWT } from '../utils/jwt';
import { deleteImages, processAndUploadImage } from '../utils/imagekit';
import { MultipartFile } from '@fastify/multipart';

dotenv.config();

export const authLogin = async (request: FastifyRequest, reply: FastifyReply) => {
    try{
        const { email, password } = request.body as { email: string; password: string };
        const { rows } = await pool.query("SELECT FUN.*, PES.* FROM FUNCIONARIO FUN JOIN PESSOA PES ON FUN.CODIGOPESSOA = PES.CODIGOPESSOA WHERE EMAIL = $1 LIMIT 1", [email]);

        if (rows.length === 0) {
            return reply.code(401).send({ error: "Usuário ou senha incorretos!" });
        }

        if(rows[0].situacao === 0){
            return reply.code(401).send({ error: "Funcionário inativo!" });
        }

        if(! await comparePassword(password, rows[0].senha)){
            return reply.code(401).send({ error: "Usuário ou senha incorretos!" });
        }

        const JWTToken = await createJWT(rows[0]);

        reply
            .setCookie('token', JWTToken, { // Correção do nome da variável
                httpOnly: true,
                maxAge: 3600000, // 1 hora
                secure: true, // tesntando
                sameSite: 'none',
                path: '/',
            })
            .code(200)
            .send({ message: 'Logged successfully!', data: JWTToken});
    }catch(err){
        console.log(err)
        reply.code(400).send({ message: 'Something went wrong!', data: err});
    }
};

export const authJWT = async(request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies.token;
    if(!token){
        return reply.status(401).send({ message: 'Token not found!' });
    }
    const resp = await verifyJWT(token)

    if(resp){
        const query = `
            SELECT 
                FUN.*,
                PES.*
            FROM PESSOA PES JOIN FUNCIONARIO FUN ON PES.CODIGOPESSOA = FUN.CODIGOPESSOA
            WHERE PES.TIPOPESSOA = 2 AND FUN.CODIGOPESSOA = $1 LIMIT 1
        `
        const data = resp.funcionario.codigopessoa
        const result = await pool.query(query, [data])
        const funcionario = result.rows[0]
        const { senha, ...funcionarioFormated } = funcionario;

        reply.status(200).send({ message: 'Logged successfully!', data: funcionarioFormated });
    }else{
        console.log(resp)
        reply.status(401).send({ message: 'Invalid JWT Token!' });
    }
};

export const logout = async (request: FastifyRequest, reply: FastifyReply) => {
    reply
      .clearCookie('token', {
        httpOnly: true,
        secure: true,          // igual ao que foi setado no login
        sameSite: 'none',      // igual ao que foi setado no login
        path: '/',             // igual ao que foi setado no login
        expires: new Date(0), // data no passado
      })
      .code(200)
      .send({ message: 'Logout realizado com sucesso!' });
  };

export const authRegister = async (request: FastifyRequest, reply: FastifyReply) => {

    try{
        const { username, email, password } = request.body as { username: string; email: string; password: string };
        const hashedPassword = await hashPassword(password)
        const row = await pool.query('INSERT INTO FUNCIONARIO (USUARIO, SENHA, EMAIL) VALUES ($1, $2, $3) RETURNING ID', [username, hashedPassword, email]) 
    
        reply.code(201).send({ message: "Registered succesfully!", data: row.rows[0] });
    }catch(err){
        reply.code(400).send({ message: "Something went wrong!", data: err });
    }
};

export const putConta = async (request: FastifyRequest, reply: FastifyReply) => {
    try{
        const { conta: contaField, image } = request.body as { conta: { value: string }, image?: MultipartFile };
        const token = request.cookies.token;

        if(!token){
            return reply.code(401).send({ error: "Token not found!" });
        }

        const resp = await verifyJWT(token)
        if(!resp){
            return reply.code(401).send({ error: "Invalid JWT Token!" });
        }
        
        const conta = JSON.parse(contaField.value);
        
        if(conta.novaSenha){ // Verifica se senha anterior esta correta
            const { rows } = await pool.query("SELECT SENHA FROM FUNCIONARIO WHERE CODIGOFUNCIONARIO = $1 AND CODIGOPESSOA = $2 LIMIT 1", [conta.codigofuncionario, conta.codigopessoa]);
            if(rows.length === 0){
                return reply.code(401).send({ error: "Usuário ou senha incorretos!" });
            }
            if(! await comparePassword(conta.senhaAtual, rows[0].senha)){
                return reply.code(401).send({ error: "Usuário ou senha incorretos!" });
            }
        }

        let imagemUrl = null;
        let imageID = null;
        const queryImagem = 'SELECT IMAGEM FROM PESSOA WHERE CODIGOPESSOA = $1 LIMIT 1';
        const { rows: [imagemBDId] } = await pool.query(queryImagem, [conta.codigopessoa]);

        if(image){ // Imagem foi enviada
            if (imagemBDId.imagem) await deleteImages([imagemBDId.imagem]);

            // Envio nova imagem
            imageID = await processAndUploadImage(image, '/PessoasImagens');

            // Crio URL com a nova imagem
            imagemUrl = imageID

        }else{ // Imagem não foi enviada
            if(conta.imageChanged == 2) { // Imagem prévia removida
                // Remove imagem do banco e deleta do ImageKit
                if(imagemBDId.imagem){ // tem imagem no banco
                    const queryImagem = 'UPDATE PESSOA SET IMAGEM = $1 WHERE CODIGOPESSOA = $2';
                    await pool.query(queryImagem, [null, conta.codigopessoa]);
                    await deleteImages([imagemBDId.imagem]);
                }
            }else{ // Não alterou a imagem prévia
                imagemUrl = imagemBDId.imagem ? imagemBDId.imagem : null;
            }
        }

        const novaSenha = conta.novaSenha ? await hashPassword(conta.novaSenha) : null

        await pool.query('BEGIN');

        const queryFuncionario = `
            UPDATE FUNCIONARIO
            SET 
                SENHA = COALESCE($1, SENHA),
                EMAIL = COALESCE($2, EMAIL)
            WHERE CODIGOFUNCIONARIO = $3 AND CODIGOPESSOA = $4
        `;
        const dataFuncionario = [novaSenha, conta.email, conta.codigofuncionario, conta.codigopessoa]
        const resultFuncionario = await pool.query(queryFuncionario, dataFuncionario)

        const queryPessoa = `
            UPDATE PESSOA
            SET 
                NOME = COALESCE($1, NOME),
                CONTATO = COALESCE($2, CONTATO),
                IMAGEM = COALESCE($3, IMAGEM)
            WHERE CODIGOPESSOA = $4 AND TIPOPESSOA = 2
        `;
        const dataPessoa = [conta.nome, conta.contato, imagemUrl, conta.codigopessoa]
        const resultPessoa = await pool.query(queryPessoa, dataPessoa);

        const novaConta = {
            ...conta,
            imagem: imagemUrl
        }

        await pool.query('COMMIT');

        reply.code(200).send({ message: "Conta atualizada com sucesso!", data: novaConta });
    }catch(err){
        //console.log(err)
        await pool.query('ROLLBACK');
        reply.code(400).send({ message: "Something went wrong!", data: err });
    }
}