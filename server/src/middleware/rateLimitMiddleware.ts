import type { Request, Response, NextFunction } from "express";
import { TokenBucketLimiter } from "../rateLimiter/tokenBucket.js";
import { SlidingWindowLimiter } from "../rateLimiter/slidingWindow.js";
import { getRateLimitConfig, logTraffic } from "../db/queries.js";
import type { Broadcaster } from "../ws/broadcaster.js";

const DEFAULT_CONFIG = {
  algorithm: "token_bucket" as const,
  capacity: 20,
  refillPerSec: 5,
  windowMs: 1000,
  windowLimit: 20,
};

const configCache = new Map<string, typeof DEFAULT_CONFIG & { algorithm: "token_bucket" | "sliding_window" }>();

async function resolveConfig(clientId: string) {
  const cached = configCache.get(clientId);
  if (cached) return cached;
  const stored = await getRateLimitConfig(clientId);
  const resolved = stored ?? { ...DEFAULT_CONFIG, clientId };
  configCache.set(clientId, resolved);
  return resolved;
}

export function invalidateConfigCache(clientId: string): void {
  configCache.delete(clientId);
}

const tokenBucket = new TokenBucketLimiter((clientId) => {
  const cfg = configCache.get(clientId) ?? DEFAULT_CONFIG;
  return { capacity: cfg.capacity, refillPerSec: cfg.refillPerSec };
});

const slidingWindow = new SlidingWindowLimiter((clientId) => {
  const cfg = configCache.get(clientId) ?? DEFAULT_CONFIG;
  return { windowMs: cfg.windowMs, limit: cfg.windowLimit };
});

export function rateLimitMiddleware(broadcaster: Broadcaster) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const clientId = (req.header("x-client-id") ?? req.ip ?? "anonymous").toString();
    const config = await resolveConfig(clientId);

    const limiter = config.algorithm === "sliding_window" ? slidingWindow : tokenBucket;
    const decision = limiter.check(clientId);

    const ts = Date.now();
    await logTraffic({
      ts,
      clientId,
      upstream: req.path.split("/")[2] ?? "unknown",
      method: req.method,
      path: req.path,
      allowed: decision.allowed,
      limiterType: config.algorithm,
      statusCode: decision.allowed ? undefined : 429,
    });

    broadcaster.broadcast({
      type: "traffic",
      ts,
      clientId,
      upstream: req.path.split("/")[2] ?? "unknown",
      allowed: decision.allowed,
      limiterType: config.algorithm,
      statusCode: decision.allowed ? undefined : 429,
    });

    if (!decision.allowed) {
      res.setHeader("Retry-After", Math.ceil((decision.retryAfterMs ?? 1000) / 1000));
      res.status(429).json({ error: "rate limit exceeded", retryAfterMs: decision.retryAfterMs });
      return;
    }

    res.setHeader("X-RateLimit-Remaining", String(decision.remaining));
    next();
  };
}
