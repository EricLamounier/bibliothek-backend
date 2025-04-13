import Fastify from 'fastify';
import formbody from '@fastify/formbody';
import cors from '@fastify/cors';
import booksRoute from './routes/books.route';
import authenticationRoute from './routes/auth.route';
import cookie from '@fastify/cookie';
import editoraRoutes from './routes/editora.route';
import autorRoutes from './routes/autor.route';
import professorRoutes from './routes/professor.route';
import disciplinaRoutes from './routes/disciplina.route';
import livroRoutes from './routes/livro.route';

const app = Fastify({
  logger: {
    level: 'warn', // Apenas logs de warning ou erro
  },
});

app.register(formbody);

app.register(cors, {
  origin: ["http://localhost:5173", "http://192.168.3.9:5173", "http://169.254.83.107:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});

app.register(cookie);

app.register(authenticationRoute, { prefix: '/auth'});
//app.register(booksRoute, { prefix: '/livros'});
app.register(editoraRoutes, { prefix: '/editora'})
app.register(autorRoutes, { prefix: '/autor'})
app.register(professorRoutes, { prefix: '/professor'})
app.register(disciplinaRoutes, { prefix: '/disciplina'})
app.register(livroRoutes, { prefix: '/livro'})
//app.register(alunoRoutes, { prefix: '/alunos' });


export default app;
