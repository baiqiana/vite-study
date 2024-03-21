import connect from "connect";
import { red } from "picocolors";
import { WebSocketServer, WebSocket } from "ws";
import { HMR_PORT } from "./constants";

export function createWebSocketServer(server) {
  let wss;
  wss = new WebSocketServer({ port: HMR_PORT });
  wss.on("connection", (socket) => {
    socket.send(JSON.stringify({ type: "connected" }));
  });

  wss.on("error", (e) => {
    if (e.code !== "EADDRINUSE") {
      console.error(red(`WebSocket server error: \n ${e.stack || e.message}`));
    }
  });

  return {
    send(payload) {
      const stringified = JSON.stringify(payload);
      wss.clients.forEach((c) => {
        if (c.readyState === WebSocket.OPEN) {
          c.send(stringified);
        }
      });
    },

    close() {
      wss.close();
    },
  };
}
