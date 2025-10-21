import Fastify from 'fastify';
import formbody from '@fastify/formbody';
import cors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import cookie from '@fastify/cookie';
import fs from 'fs';

import authenticationRoute from './routes/auth.route';
import editoraRoutes from './routes/editora.route';
import autorRoutes from './routes/autor.route';
import professorRoutes from './routes/professor.route';
import disciplinaRoutes from './routes/disciplina.route';
import alunoRoutes from './routes/aluno.route';
import funcionarioRoutes from './routes/funcionario.route';
import livroRoutes from './routes/livro.route';
import emprestimoRoutes from './routes/emprestimo.route';
import resetPasswordRoute from './routes/resetPassword.route';
import syncRoutes from './routes/sync';
import requestLogger from './utils/requestLogger';
import logsRoutes from './routes/logs';
import postFeedback from './routes/feedBack';

const app = Fastify({
  logger: {
    level: 'warn', // Apenas logs de warning ou erro
  },
});

const allowedOrigins = [
  "https://bibliothek-test.vercel.app", // produção
  "http://192.168.3.9:5173",            // dev local
  "https://192.168.3.9:5173"
];
/*
app.addHook("onRequest", (req, reply, done) => {
  const origin = req.headers.origin;

  // Bloqueia navegação direta (sem header Origin)
  if (!origin) {
    reply.code(403).send({ error: "Forbidden" });
    return;
  }

  // Bloqueia qualquer origin NÃO permitido
  if (!allowedOrigins.includes(origin)) {
    reply.code(403).send({ error: "Forbidden" });
    return;
  }

  done();
});*/

app.register(formbody);
app.register(fastifyMultipart, {
  attachFieldsToBody: true,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  }
});
app.register(cors, {
  origin: [
    "http://192.168.3.9:5173", 
    "https://192.168.3.9:5173", 
    "https://bibliothek-test.vercel.app",
    "https://169.254.83.107:5173"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});

// Rotas auxiliares
app.get("/", async () => {
  return { status: "API Running!", time: new Date().toISOString() };
});
app.get("/favicon.ico", async (_, reply) => {
  return reply.code(204).send();
});
app.get("/favicon.png", async (_, reply) => {
  return reply.code(204).send();
});
//

app.register(cookie);
app.register(requestLogger);

app.register(authenticationRoute, { prefix: '/auth'});
app.register(resetPasswordRoute, { prefix: '/resetPassword'});
app.register(editoraRoutes, { prefix: '/editora'});
app.register(autorRoutes, { prefix: '/autor'});
app.register(professorRoutes, { prefix: '/professor'});
app.register(alunoRoutes, { prefix: '/aluno'});
app.register(funcionarioRoutes, { prefix: '/funcionario'});
app.register(disciplinaRoutes, { prefix: '/disciplina'});
app.register(livroRoutes, { prefix: '/livro'});
app.register(emprestimoRoutes, { prefix: '/emprestimo'});
app.register(syncRoutes, { prefix: '/sync'});
app.register(postFeedback, { prefix: '/feedback'});
app.register(logsRoutes, { prefix: '/admin' });

export default app;
