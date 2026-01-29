import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { ChatMessage } from "./types/system.types";

let wss: WebSocketServer | null = null;

export const initRealtimeServer = (server: Server) => {
  if (wss) {
    return wss;
  }

  wss = new WebSocketServer({
    server,
    path: "/ws",
    perMessageDeflate: false,
  });

  wss.on("connection", (socket: WebSocket) => {
    socket.send(JSON.stringify({
      type: "CONNECTED",
      data: { timestamp: Date.now() },
      timestamp: Date.now(),
    }));
  });

  return wss;
};

export const broadcastChatMessage = (message: ChatMessage) => {
  if (!wss) return;
  const payload = JSON.stringify({
    type: "chat-message",
    data: message,
    timestamp: Date.now(),
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};
