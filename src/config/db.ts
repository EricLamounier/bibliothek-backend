import { Pool } from 'pg';
import dotenv from 'dotenv';
import { Client, types } from "pg";
import cron from 'node-cron';

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

// Executa todo dia à meia-noite
cron.schedule("0 0 * * *", async () => {
  const now = new Date(Date.now()).toISOString();
  try {
    await pool.query("DELETE FROM REFRESH_TOKENS WHERE expira_em <= $1", [now]);
    console.log(`[CRON] Hashes expirados removidos às ${now}`);
  } catch (err) {
    console.error("[CRON] Erro ao remover hashes expirados:", err);
  }
});

connect();

export default pool;