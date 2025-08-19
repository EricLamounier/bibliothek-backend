import app from './src/app';
import dotenv from 'dotenv';
dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0'

app.get('/favicon.ico', (req, res) => res.status(204));

app.get('/teste', (req, res)=>{
  res.status(200).send({message: 'ola'})
})

app.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});