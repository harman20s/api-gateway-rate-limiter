import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { runMigrations } from "./db/pool.js";
import { Broadcaster } from "./ws/broadcaster.js";
import { rateLimitMiddleware } from "./middleware/rateLimitMiddleware.js";
import { mountGatewayRoutes } from "./gateway/proxy.js";
import { adminRouter } from "./routes/admin.js";
import { startSampleService } from "./upstreamServices/sampleService.js";
import { upstreams } from "./gateway/upstreams.js";

runMigrations();

startSampleService("users-service", 4001);
startSampleService("orders-service", 4002);

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const broadcaster = new Broadcaster(server, "/ws");

app.use("/admin", adminRouter);

for (const upstream of upstreams) {
  app.use(upstream.routePrefix, rateLimitMiddleware(broadcaster));
}
mountGatewayRoutes(app, broadcaster);

app.get("/health", (_req, res) => res.json({ status: "ok", upstreams: upstreams.map((u) => u.name) }));

const PORT = Number(process.env.PORT ?? 4000);
server.listen(PORT, () => {
  console.log(`[gateway] listening on http://localhost:${PORT}`);
  console.log(`[gateway] websocket dashboard feed on ws://localhost:${PORT}/ws`);
});
