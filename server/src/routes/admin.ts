import { Router } from "express";
import {
  getRecentTraffic,
  getTrafficStatsSince,
  getRecentBreakerEvents,
  saveRateLimitConfig,
  getAllRateLimitConfigs,
} from "../db/queries.js";
import { breakers, upstreams } from "../gateway/upstreams.js";
import { invalidateConfigCache } from "../middleware/rateLimitMiddleware.js";

export const adminRouter = Router();

adminRouter.get("/traffic", async (req, res) => {
  const limit = Number(req.query.limit ?? 200);
  res.json(await getRecentTraffic(limit));
});

adminRouter.get("/stats", async (req, res) => {
  const windowMs = Number(req.query.windowMs ?? 10_000);
  const stats = await getTrafficStatsSince(Date.now() - windowMs);
  res.json({ ...stats, windowMs });
});

adminRouter.get("/breakers", (_req, res) => {
  res.json(
    upstreams.map((u) => ({
      name: u.name,
      routePrefix: u.routePrefix,
      state: breakers.get(u.name)!.getState(),
    }))
  );
});

adminRouter.get("/breaker-events", async (req, res) => {
  const limit = Number(req.query.limit ?? 50);
  res.json(await getRecentBreakerEvents(limit));
});

adminRouter.get("/configs", async (_req, res) => {
  res.json(await getAllRateLimitConfigs());
});

adminRouter.put("/configs/:clientId", async (req, res) => {
  const clientId = req.params.clientId;
  const { algorithm, capacity, refillPerSec, windowMs, windowLimit } = req.body ?? {};

  await saveRateLimitConfig({
    clientId,
    algorithm: algorithm === "sliding_window" ? "sliding_window" : "token_bucket",
    capacity: Number(capacity ?? 20),
    refillPerSec: Number(refillPerSec ?? 5),
    windowMs: Number(windowMs ?? 1000),
    windowLimit: Number(windowLimit ?? 20),
  });
  invalidateConfigCache(clientId);

  res.json({ ok: true });
});
