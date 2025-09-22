import app from "./src/app";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

// --- WebSocket Config ---
const clientsById = new Map<string, Set<WebSocket>>();
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws: WebSocket) => {
  let clientId: string = "";
  let inactivityTimeout: NodeJS.Timeout;

  const resetTimeout = () => {
    if (inactivityTimeout) clearTimeout(inactivityTimeout);
    inactivityTimeout = setTimeout(() => {
      if (clientId && clientsById.has(clientId)) {
        const set = clientsById.get(clientId)!;
        set.delete(ws);
        if (set.size === 0) {
          clientsById.delete(clientId);
        }
        ws.close();
        console.log(`Cliente ${clientId} removido por inatividade (10 min).`);
      }
    }, 10 * 60 * 1000); // 10 minutos
  };

  ws.on("message", (rawMessage: string) => {
    try {
      const data = JSON.parse(rawMessage.toString());

      // Sempre que chega mensagem, reinicia o timeout
      resetTimeout();

      // Registro de ID
      if (data.type === "register" && data.codigofuncionario) {
        clientId = data.codigofuncionario;

        if (!clientsById.has(clientId)) {
          clientsById.set(clientId, new Set());
        }

        clientsById.get(clientId)!.add(ws);

        ws.send(JSON.stringify({ type: "ack", status: "registered", id: clientId }));
      }

      // Envio de mensagem
      if (data.type === "send" && clientId) {
        const infoJson = JSON.parse(data.message);
        const sockets = clientsById.get(clientId);

        if (sockets) {
          sockets.forEach((clientWs) => {
            if (clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
              const formatedData = {
                type: infoJson.tipo === 2 ? "livro" : "pessoa",
                from: clientId,
                message: JSON.stringify(infoJson),
              };
              clientWs.send(JSON.stringify(formatedData));
            }
          });
        }
      }
    } catch (err) {
      console.error(err);
      ws.send(JSON.stringify({ type: "error", error: "Formato inválido" }));
    }
  });

  ws.on("close", () => {
    if (inactivityTimeout) clearTimeout(inactivityTimeout);
    if (clientId && clientsById.has(clientId)) {
      const set = clientsById.get(clientId)!;
      set.delete(ws);
      if (set.size === 0) {
        clientsById.delete(clientId);
      }
    }
  });

  // inicia o timeout assim que conecta
  resetTimeout();
});

// --- Rotas Extras ---
app.get("/favicon.ico", (req, res) => res.status(204));
app.get("/teste", (req, res) => {
  res.status(200).send({ message: "ola" });
});

// --- Upgrade para WS ---
app.server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket as any, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

// --- Inicialização ---
app.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
