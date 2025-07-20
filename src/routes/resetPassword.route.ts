import { FastifyInstance } from 'fastify';
import { sendOtp, checkOtp, resetPassword } from '../controllers/resetPassword.controller';

async function resetPasswordRoute(fastify: FastifyInstance) {
  fastify.post('/otp', sendOtp);
  fastify.post('/checkOtp', checkOtp);
  fastify.post('/resetPassword', resetPassword);
}

export default resetPasswordRoute;