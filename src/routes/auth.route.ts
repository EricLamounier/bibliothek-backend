import { FastifyInstance } from 'fastify';
import { authJWT, authLogin, authRegister, logout } from '../controllers/auth.controller';

async function authenticationRoute(fastify: FastifyInstance) {
  fastify.post('/login', authLogin);
  fastify.post('/register', authRegister);
  fastify.post('/JWT', authJWT);
  fastify.post('/logout', logout);
}

export default authenticationRoute;