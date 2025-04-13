import { FastifyInstance } from 'fastify';
import { deleteEditora, getEditora, postEditora, putEditora } from '../controllers/editora.controller';

/*const getEditoraOptions = {
  schema: {
      querystring: {
          type: 'object',
          properties: {
              nome: { type: 'string' },
              situacao: { 
                  type: 'array',
                  items: { type: 'number' }
              }
          }
      }
  }
};*/

async function editoraRoutes(fastify: FastifyInstance) {
  fastify.post('/post', postEditora);
  //fastify.get('/get', getEditoraOptions, getEditora);
  fastify.get('/get', getEditora);
  fastify.delete('/delete', deleteEditora);
  fastify.put('/put', putEditora);
}

export default editoraRoutes;