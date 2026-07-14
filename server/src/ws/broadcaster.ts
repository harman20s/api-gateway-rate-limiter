import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";

export type GatewayEvent =
  | { type: "traffic"; ts: number; clientId: string; upstream: string; allowed: boolean; limiterType: string; statusCode?: number; latencyMs?: number }
  | { type: "breaker_state"; ts: number; upstream: string; from: string; to: string; reason: string }
  | { type: "stats"; ts: number; allowed: number; blocked: number; windowMs: number };

export class Broadcaster {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();

  constructor(server: Server, path = "/ws") {
    this.wss = new WebSocketServer({ server, path });
    this.wss.on("connection", (socket) => {
      this.clients.add(socket);
      socket.on("close", () => this.clients.delete(socket));
      socket.on("error", () => this.clients.delete(socket));
    });
  }

  broadcast(event: GatewayEvent): void {
    const payload = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}
