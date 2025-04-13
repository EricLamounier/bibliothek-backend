import app from './src/app';
import dotenv from 'dotenv';
dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const HOST = '192.168.3.9'; // Permite acessar pelo IP da máquina na rede
// const HOST = '169.254.83.107'
console.clear();

app.get('/favicon.ico', (req, res) => res.status(204));

app.get('/teste', (req, res)=>{
  res.status(200).send({message: 'ola'})
})

app.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Servidor rodando em ${address}`);
});