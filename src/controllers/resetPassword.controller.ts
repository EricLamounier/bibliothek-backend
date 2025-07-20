import { FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import pool from '../config/db';
import { comparePassword, createJWT, hashPassword, verifyJWT } from '../utils/jwt';
import { generateCode, sendEmails } from '../gmail/gmail';
import { pwdCodes } from '../utils/recuperacaoSenha';

export const sendOtp = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { email } = request.body as { email: string };
        const { rows } = await pool.query(`
            SELECT FUN.EMAIL, PES.NOME 
            FROM FUNCIONARIO FUN JOIN PESSOA PES ON FUN.CODIGOFUNCIONARIO = PES.CODIGOPESSOA 
            WHERE EMAIL = $1 LIMIT 1
        `, [email]);

        if (rows.length === 0) {
            return reply.code(401).send({ error: "Email não encontrado!" });
        }

        const message = `Hey, ${rows[0].nome}! Aqui está seu código de verificação. Ele tem validade de 10 minutos!`;
        const otp = generateCode();
        console.log(otp)

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

        pwdCodes.set(email, { otp, expiresAt: new Date(Date.now() + 600000), timeout });

        await sendEmails(rows[0].nome, rows[0].email, otp, message, 'Recuperação de acesso');

        reply.status(200).send({ message: 'Código de verificação enviado com sucesso!', data: rows[0] });
        await pool.query('COMMIT');
    } catch (err) {
        console.log(err)
        reply.code(400).send({ message: "Something went wrong!", data: err });
    }
};

export const checkOtp = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { email, otp } = request.body as { email: string; otp: string };
        if (!pwdCodes.has(email)) {
            return reply.code(401).send({ error: "Código de verificação inválido!" });
        }
        const { otp: storedCode, expiresAt } = pwdCodes.get(email)!;
        if (otp !== storedCode) {
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

export const resetPassword = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { email, password } = request.body as { email: string; password: string };
        console.log(email, password)

        const hashedPassword = await hashPassword(password)
        await pool.query('BEGIN');
        await pool.query('UPDATE FUNCIONARIO SET SENHA = $1 WHERE EMAIL = $2', [hashedPassword, email]);
        await pool.query('COMMIT');

        reply.status(200).send({ message: 'Senha resetada com sucesso!' });
    } catch (err) {
        reply.code(400).send({ message: "Something went wrong!", data: err });
    }
};