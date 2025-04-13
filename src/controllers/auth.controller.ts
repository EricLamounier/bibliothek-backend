import { FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import pool from '../config/db';
import { createJWT, verifyJWT } from '../utils/jwt';

dotenv.config();

async function hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 9);
};

async function comparePassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
};

export const authLogin = async (request: FastifyRequest, reply: FastifyReply) => {
    try{
        const { email, password } = request.body as { email: string; password: string };

        const { rows } = await pool.query("SELECT * FROM USUARIO WHERE EMAIL = $1 LIMIT 1", [email]);
        if (rows.length === 0) {
            return reply.code(401).send({ error: "User not found!" });
        }

        if(! await comparePassword(password, rows[0].senha)){
            return reply.code(401).send({ error: "Wrong password!" });
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
        const query = 'SELECT * FROM USUARIO WHERE id = $1 LIMIT 1'
        const data = [resp.userID]
        const result = await pool.query(query, data)
        const user = result.rows[0]

        reply.status(200).send({ message: 'Logged successfully!', data: user });
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
        console.log(hashedPassword)
        const row = await pool.query('INSERT INTO USUARIO (USUARIO, SENHA, EMAIL) VALUES ($1, $2, $3) RETURNING ID', [username, hashedPassword, email]) 
    
        reply.code(201).send({ message: "Registered succesfully!", data: row.rows[0] });
    }catch(err){
        reply.code(400).send({ message: "Something went wrong!", data: err });
    }
};