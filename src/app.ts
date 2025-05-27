import Fastify from 'fastify';
import formbody from '@fastify/formbody';
import cors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import cookie from '@fastify/cookie';

import authenticationRoute from './routes/auth.route';
import editoraRoutes from './routes/editora.route';
import autorRoutes from './routes/autor.route';
import professorRoutes from './routes/professor.route';
import disciplinaRoutes from './routes/disciplina.route';
import alunoRoutes from './routes/aluno.route';
import funcionarioRoutes from './routes/funcionario.route';
import livroRoutes from './routes/livro.route';
import emprestimoRoutes from './routes/emprestimo.route';
import testeRoutes from './routes/teste.route';


const app = Fastify({
  logger: {
    level: 'warn', // Apenas logs de warning ou erro
  },
});

app.register(formbody);
app.register(fastifyMultipart, {
  attachFieldsToBody: true,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  }
});
app.register(cors, {
  origin: ["http://localhost:5173", "http://192.168.3.9:5173", "http://200.18.135.228:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});

app.register(cookie);

app.register(authenticationRoute, { prefix: '/auth'});
app.register(editoraRoutes, { prefix: '/editora'});
app.register(autorRoutes, { prefix: '/autor'});
app.register(professorRoutes, { prefix: '/professor'});
app.register(alunoRoutes, { prefix: '/aluno'});
app.register(funcionarioRoutes, { prefix: '/funcionario'});
app.register(disciplinaRoutes, { prefix: '/disciplina'});
app.register(livroRoutes, { prefix: '/livro'});
app.register(emprestimoRoutes, { prefix: '/emprestimo'});

app.register(testeRoutes, {prefix: '/teste'});


export default app;
