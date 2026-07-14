import type { RateLimitDecision, RateLimiter } from "./types.js";

interface BucketState {
  tokens: number;
  lastRefillTs: number;
}

export interface TokenBucketOptions {
  capacity: number;
  refillPerSec: number;
}

export interface TokenBucketConfigResolver {
  (clientId: string): TokenBucketOptions;
}

/**
 * Classic token bucket, lazily refilled on each check() call instead of
 * a background timer. Each client gets an independent bucket.
 *
 * Correctness note: check() never awaits, so within a single Node process
 * the read-modify-write on a client's bucket is atomic per event-loop turn —
 * there is no interleaving window for a race. That guarantee breaks the moment
 * this state is shared across processes (cluster/PM2/multiple gateway instances),
 * which is why production deployments move this state into Redis with a Lua
 * script or `INCR`+`EXPIRE` to keep the check atomic across processes.
 */
export class TokenBucketLimiter implements RateLimiter {
  private buckets = new Map<string, BucketState>();

  constructor(private getConfig: TokenBucketConfigResolver) {}

  check(clientId: string): RateLimitDecision {
    const { capacity, refillPerSec } = this.getConfig(clientId);
    const now = Date.now();

    let bucket = this.buckets.get(clientId);
    if (!bucket) {
      bucket = { tokens: capacity, lastRefillTs: now };
      this.buckets.set(clientId, bucket);
    }

    const elapsedSec = (now - bucket.lastRefillTs) / 1000;
    if (elapsedSec > 0) {
      bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * refillPerSec);
      bucket.lastRefillTs = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, remaining: Math.floor(bucket.tokens) };
    }

    const deficitTokens = 1 - bucket.tokens;
    const retryAfterMs = Math.ceil((deficitTokens / refillPerSec) * 1000);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  reset(clientId: string): void {
    this.buckets.delete(clientId);
  }

  snapshot(): Array<{ clientId: string; tokens: number }> {
    return [...this.buckets.entries()].map(([clientId, s]) => ({
      clientId,
      tokens: Math.floor(s.tokens),
    }));
  }
}
