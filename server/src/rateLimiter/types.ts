export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

export interface RateLimiter {
  /** Returns a decision for a single request from clientId. Must be safe under concurrent calls for the same clientId. */
  check(clientId: string): RateLimitDecision;
}
