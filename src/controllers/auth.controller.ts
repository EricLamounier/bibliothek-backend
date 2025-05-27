import { FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import pool from '../config/db';
import { comparePassword, createJWT, hashPassword, verifyJWT } from '../utils/jwt';
import { generateCode, sendEmails } from '../utils/gmail';
import { pwdCodes } from '../utils/recuperacaoSenha';

dotenv.config();

export const authLogin = async (request: FastifyRequest, reply: FastifyReply) => {
    try{
        const { email, password } = request.body as { email: string; password: string };

        const { rows } = await pool.query("SELECT FUN.*, PES.SITUACAO FROM FUNCIONARIO FUN JOIN PESSOA PES ON FUN.PESSOA_ID = PES.ID  WHERE EMAIL = $1 AND PES.SITUACAO = 1 LIMIT 1", [email]);
        if (rows.length === 0) {
            return reply.code(401).send({ error: "Usuário ou senha incorretos!" });
        }

        if(rows[0].situacao === 0){
            return reply.code(401).send({ error: "Funcionário inativo!" });
        }

        if(! await comparePassword(password, rows[0].senha)){
            return reply.code(401).send({ error: "Usuário ou senha incorretos!" });
        }

        const JWTToken = await createJWT(rows[0].id);


        reply
            .setCookie('token', JWTToken, { // Correção do nome da variável
                httpOnly: true,
                secure: false, // tesntando
                maxAge: 3600000, // 1 hora
                sameSite: 'strict',
                path: '/',
            })
            .code(200)
            .send({ message: 'Logged successfully!', data: JWTToken});
    }catch(err){
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
            WHERE PES.TIPO = 2 AND FUN.ID = $1 LIMIT 1
        `
        const data = [resp.userID]
        const result = await pool.query(query, data)
        const user = result.rows[0]

        const userFormated = {
            ...user,
            imagem: user.imagem ? `https://ik.imagekit.io/bibliothek/PessoasImagens/${user.imagem}.png` : null,
        }

        reply.status(200).send({ message: 'Logged successfully!', data: userFormated });
    }else{
        reply.status(401).send({ message: 'Invalid JWT Token!' });
    }
};

export const logout = async(request: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie('token', { path: '/' })
    .code(200).send({ message: 'Logout realizado com sucesso!' });
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
        const { conta } = request.body

        if(conta.novaSenha){ // Verifica se senha anterior esta correta
            const { rows } = await pool.query("SELECT SENHA FROM FUNCIONARIO WHERE ID = $1 AND PESSOA_ID = $2 LIMIT 1", [conta.funcionarioid, conta.pessoaid]);
            if(rows.length === 0){
                return reply.code(401).send({ error: "Usuário ou senha incorretos!" });
            }
            if(! await comparePassword(conta.senhaAtual, rows[0].senha)){
                return reply.code(401).send({ error: "Usuário ou senha incorretos!" });
            }
        }

        const novaSenha = conta.novaSenha ? await hashPassword(conta.novaSenha) : null

        await pool.query('BEGIN');

        const queryFuncionario = `
            UPDATE FUNCIONARIO
            SET 
                USUARIO = COALESCE($1, USUARIO),
                SENHA = COALESCE($2, SENHA),
                EMAIL = COALESCE($3, EMAIL)
            WHERE ID = $4 AND PESSOA_ID = $5
        `;
        const dataFuncionario = [conta.username, novaSenha, conta.email, conta.funcionarioid, conta.pessoaid]
        const resultFuncionario = await pool.query(queryFuncionario, dataFuncionario)

        const queryPessoa = `
            UPDATE PESSOA
            SET 
                NOME = COALESCE($1, NOME),
                CONTATO = COALESCE($2, CONTATO)
            WHERE ID = $3 AND TIPO = 2
        `;
        const dataPessoa = [conta.nome, conta.contato, conta.pessoaid]
        const resultPessoa = await pool.query(queryPessoa, dataPessoa);

        const novaConta = {
            ...conta
        }

        await pool.query('COMMIT');

        reply.code(200).send({ message: "Conta atualizada com sucesso!", data: novaConta });
    }catch(err){
        console.log(err)
        await pool.query('ROLLBACK');
        reply.code(400).send({ message: "Something went wrong!", data: err });
    }
}

export const otp = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { email } = request.body as { email: string };
        const { rows } = await pool.query(`
            SELECT FUN.EMAIL, PES.NOME 
            FROM FUNCIONARIO FUN JOIN PESSOA PES ON FUN.PESSOA_ID = PES.ID 
            WHERE EMAIL = $1 AND PES.SITUACAO = 1 LIMIT 1
        `, [email]);

        if (rows.length === 0) {
            return reply.code(401).send({ error: "Usuário ou senha incorretos!" });
        }

        const message = `Hey, ${rows[0].nome}! Aqui está seu código de verificação. Ele tem validade de 10 minutos!`;
        const code = generateCode();

        // Se já existe um código para o e-mail, limpa o timeout anterior
        if (pwdCodes.has(email)) {
            const existing = pwdCodes.get(email);
            if (existing) {
                clearTimeout(existing.timeout);
            }
        }

        const timeout = setTimeout(() => {
            pwdCodes.delete(email);
        }, 600000);

        pwdCodes.set(email, { code, expiresAt: new Date(Date.now() + 600000), timeout });

        await sendEmails(rows[0].nome, rows[0].email, code, message, 'Recuperação de acesso');

        reply.status(200).send({ message: 'Código de verificação enviado com sucesso!', data: rows[0] });
        await pool.query('COMMIT');
    } catch (err) {
        reply.code(400).send({ message: "Something went wrong!", data: err });
    }
};

export const resetPasswordOtp = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { email, code } = request.body as { email: string; code: string };
        if (!pwdCodes.has(email)) {
            return reply.code(401).send({ error: "Código de verificação inválido!" });
        }
        const { code: storedCode, expiresAt } = pwdCodes.get(email)!;
        if (code !== storedCode) {
            return reply.code(401).send({ error: "Código de verificação inválido!" });
        }
        if (expiresAt < new Date()) {
            return reply.code(401).send({ error: "Código de verificação expirado!" });
        }

        pwdCodes.delete(email);

        reply.status(200).send({ message: 'Código de verificação válido!' });
    } catch (err) {
        reply.code(400).send({ message: "Something went wrong!", data: err });
    }
};