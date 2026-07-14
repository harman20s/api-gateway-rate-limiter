import type { RateLimitDecision, RateLimiter } from "./types.js";

interface WindowState {
  timestamps: number[];
}

export interface SlidingWindowOptions {
  windowMs: number;
  limit: number;
}

export interface SlidingWindowConfigResolver {
  (clientId: string): SlidingWindowOptions;
}

/**
 * True sliding-window log: keeps every request timestamp within the window
 * per client and prunes expired ones on each check. More memory-hungry than
 * a fixed-window counter but avoids the boundary-burst problem where a client
 * can send 2x the limit by timing requests around a fixed window edge.
 */
export class SlidingWindowLimiter implements RateLimiter {
  private windows = new Map<string, WindowState>();

  constructor(private getConfig: SlidingWindowConfigResolver) {}

  check(clientId: string): RateLimitDecision {
    const { windowMs, limit } = this.getConfig(clientId);
    const now = Date.now();
    const windowStart = now - windowMs;

    let state = this.windows.get(clientId);
    if (!state) {
      state = { timestamps: [] };
      this.windows.set(clientId, state);
    }

    state.timestamps = state.timestamps.filter((ts) => ts > windowStart);

    if (state.timestamps.length < limit) {
      state.timestamps.push(now);
      return { allowed: true, remaining: limit - state.timestamps.length };
    }

    const oldestInWindow = state.timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  reset(clientId: string): void {
    this.windows.delete(clientId);
  }

  snapshot(): Array<{ clientId: string; countInWindow: number }> {
    return [...this.windows.entries()].map(([clientId, s]) => ({
      clientId,
      countInWindow: s.timestamps.length,
    }));
  }
}
