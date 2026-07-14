import { db } from "./pool.js";

/**
 * All functions here are async even though better-sqlite3 is sync —
 * this keeps call sites Postgres-ready. Swapping to Postgres later means
 * rewriting this file only, not every call site.
 */

export interface TrafficLogEntry {
  ts: number;
  clientId: string;
  upstream: string;
  method: string;
  path: string;
  allowed: boolean;
  limiterType: string;
  statusCode?: number;
  latencyMs?: number;
}

const insertTrafficLog = db.prepare(`
  INSERT INTO traffic_logs (ts, client_id, upstream, method, path, allowed, limiter_type, status_code, latency_ms)
  VALUES (@ts, @clientId, @upstream, @method, @path, @allowed, @limiterType, @statusCode, @latencyMs)
`);

export async function logTraffic(entry: TrafficLogEntry): Promise<void> {
  insertTrafficLog.run({
    ...entry,
    allowed: entry.allowed ? 1 : 0,
    statusCode: entry.statusCode ?? null,
    latencyMs: entry.latencyMs ?? null,
  });
}

export async function getRecentTraffic(limit = 200): Promise<any[]> {
  return db
    .prepare(`SELECT * FROM traffic_logs ORDER BY ts DESC LIMIT ?`)
    .all(limit);
}

export async function getTrafficStatsSince(sinceTs: number): Promise<{ allowed: number; blocked: number }> {
  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN allowed = 1 THEN 1 ELSE 0 END) as allowed,
         SUM(CASE WHEN allowed = 0 THEN 1 ELSE 0 END) as blocked
       FROM traffic_logs WHERE ts >= ?`
    )
    .get(sinceTs) as { allowed: number | null; blocked: number | null };
  return { allowed: row.allowed ?? 0, blocked: row.blocked ?? 0 };
}

const insertBreakerEvent = db.prepare(`
  INSERT INTO breaker_events (ts, upstream, state, reason)
  VALUES (@ts, @upstream, @state, @reason)
`);

export async function logBreakerEvent(entry: { ts: number; upstream: string; state: string; reason?: string }): Promise<void> {
  insertBreakerEvent.run({ ...entry, reason: entry.reason ?? null });
}

export async function getRecentBreakerEvents(limit = 50): Promise<any[]> {
  return db
    .prepare(`SELECT * FROM breaker_events ORDER BY ts DESC LIMIT ?`)
    .all(limit);
}

export interface RateLimitConfig {
  clientId: string;
  algorithm: "token_bucket" | "sliding_window";
  capacity: number;
  refillPerSec: number;
  windowMs: number;
  windowLimit: number;
}

const upsertConfig = db.prepare(`
  INSERT INTO rate_limit_configs (client_id, algorithm, capacity, refill_per_sec, window_ms, window_limit)
  VALUES (@clientId, @algorithm, @capacity, @refillPerSec, @windowMs, @windowLimit)
  ON CONFLICT(client_id) DO UPDATE SET
    algorithm = excluded.algorithm,
    capacity = excluded.capacity,
    refill_per_sec = excluded.refill_per_sec,
    window_ms = excluded.window_ms,
    window_limit = excluded.window_limit
`);

export async function saveRateLimitConfig(config: RateLimitConfig): Promise<void> {
  upsertConfig.run(config as unknown as Record<string, string | number>);
}

export async function getRateLimitConfig(clientId: string): Promise<RateLimitConfig | undefined> {
  const row = db
    .prepare(`SELECT * FROM rate_limit_configs WHERE client_id = ?`)
    .get(clientId) as any;
  if (!row) return undefined;
  return {
    clientId: row.client_id,
    algorithm: row.algorithm,
    capacity: row.capacity,
    refillPerSec: row.refill_per_sec,
    windowMs: row.window_ms,
    windowLimit: row.window_limit,
  };
}

export async function getAllRateLimitConfigs(): Promise<RateLimitConfig[]> {
  const rows = db.prepare(`SELECT * FROM rate_limit_configs`).all() as any[];
  return rows.map((row) => ({
    clientId: row.client_id,
    algorithm: row.algorithm,
    capacity: row.capacity,
    refillPerSec: row.refill_per_sec,
    windowMs: row.window_ms,
    windowLimit: row.window_limit,
  }));
}
