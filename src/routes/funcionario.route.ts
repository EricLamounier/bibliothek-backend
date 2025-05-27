import { FastifyInstance } from 'fastify';
import { deleteFuncionario, getFuncionario, postFuncionario, putFuncionario, resetSenhaFuncionario } from '../controllers/funcionario.controller';

async function funcionarioRoutes(fastify: FastifyInstance) {
  fastify.post('/post', postFuncionario);
  fastify.get('/get', getFuncionario);
  fastify.delete('/delete', deleteFuncionario);
  fastify.put('/put', putFuncionario);
  fastify.put('/resetSenha', resetSenhaFuncionario);
}

export default funcionarioRoutes;