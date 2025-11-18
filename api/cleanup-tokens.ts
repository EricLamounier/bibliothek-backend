import { Client } from "pg";

export default async function handler(req, res) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  await client.connect();

  const now = new Date(Date.now()).toISOString();

  try {
    await client.query(
      "DELETE FROM REFRESH_TOKENS WHERE expira_em <= $1",
      [now]
    );

    await client.end();

    return res.status(200).json({ message: "Tokens expirados removidos", time: now });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao processar cleanup" });
  }
}
