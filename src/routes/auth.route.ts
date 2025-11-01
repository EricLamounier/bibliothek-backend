import { FastifyInstance } from 'fastify';
import { authJWT, authLogin, authRegister, logout, putConta, refreshJWT } from '../controllers/auth.controller';

async function authenticationRoute(fastify: FastifyInstance) {
  fastify.post('/login', authLogin);
  fastify.post('/register', authRegister);
  fastify.post('/verify', authJWT);
  fastify.post('/refresh', refreshJWT);
  fastify.post('/logout', logout);
  fastify.put('/putConta', putConta);
}

export default authenticationRoute;