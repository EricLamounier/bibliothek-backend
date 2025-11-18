import { Pool } from 'pg';
import dotenv from 'dotenv';
import { Client, types } from "pg";

// int2 (smallint)
types.setTypeParser(21, (val) => parseInt(val, 10));
// int4 (integer)
types.setTypeParser(23, (val) => parseInt(val, 10));


dotenv.config();

const pool = new Client(process.env.DATABASE_URL);

async function connect() {
  try {
    await pool.connect();
    const res = await pool.query("SELECT NOW()"); // query de teste
  } catch (err) {
    console.error("Erro ao conectar:", err);
  }
}

connect();

export default pool;
