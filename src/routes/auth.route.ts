import { FastifyInstance } from 'fastify';
import { authJWT, authLogin, authRegister, logout, putConta } from '../controllers/auth.controller';

async function authenticationRoute(fastify: FastifyInstance) {
  fastify.post('/login', authLogin);
  fastify.post('/register', authRegister);
  fastify.post('/JWT', authJWT);
  fastify.post('/logout', logout);
  fastify.put('/putConta', putConta);
}

export default authenticationRoute;