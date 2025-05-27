import { FastifyInstance } from 'fastify';
import { authJWT, authLogin, authRegister, logout, putConta, otp } from '../controllers/auth.controller';

async function authenticationRoute(fastify: FastifyInstance) {
  fastify.post('/login', authLogin);
  fastify.post('/register', authRegister);
  fastify.post('/JWT', authJWT);
  fastify.post('/logout', logout);
  fastify.put('/putConta', putConta);
  fastify.post('/otp', otp);
}

export default authenticationRoute;