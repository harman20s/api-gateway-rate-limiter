export type BreakerState = "closed" | "open" | "half_open";

export interface CircuitBreakerOptions {
  /** Consecutive failures required to trip from closed -> open */
  failureThreshold: number;
  /** How long to stay open before trying a half-open probe */
  resetTimeoutMs: number;
  /** Consecutive successes required in half-open to close again */
  successThreshold: number;
}

export interface BreakerStateChange {
  from: BreakerState;
  to: BreakerState;
  reason: string;
}

type Listener = (change: BreakerStateChange) => void;

/**
 * Per-upstream circuit breaker. Wraps calls to a failing dependency so the
 * gateway stops hammering it and fails fast instead, giving the upstream
 * room to recover.
 *
 * States:
 *  - closed: requests pass through normally; failures are counted.
 *  - open: requests are rejected immediately without calling upstream.
 *  - half_open: after resetTimeoutMs, a limited number of trial requests
 *    are allowed through to test recovery.
 */
export class CircuitBreaker {
  private state: BreakerState = "closed";
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private openedAt = 0;
  private listeners = new Set<Listener>();

  constructor(private readonly name: string, private readonly options: CircuitBreakerOptions) {}

  onStateChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): BreakerState {
    if (this.state === "open" && Date.now() - this.openedAt >= this.options.resetTimeoutMs) {
      this.transition("half_open", "reset timeout elapsed, probing upstream");
    }
    return this.state;
  }

  /** Call before attempting the upstream request. Throws if the breaker is open. */
  canRequest(): boolean {
    return this.getState() !== "open";
  }

  recordSuccess(): void {
    if (this.state === "half_open") {
      this.consecutiveSuccesses += 1;
      if (this.consecutiveSuccesses >= this.options.successThreshold) {
        this.transition("closed", "upstream recovered during half-open probes");
      }
    } else {
      this.consecutiveFailures = 0;
    }
  }

  recordFailure(): void {
    this.consecutiveSuccesses = 0;

    if (this.state === "half_open") {
      this.transition("open", "probe failed during half-open");
      return;
    }

    this.consecutiveFailures += 1;
    if (this.state === "closed" && this.consecutiveFailures >= this.options.failureThreshold) {
      this.transition("open", `${this.consecutiveFailures} consecutive failures`);
    }
  }

  private transition(to: BreakerState, reason: string): void {
    const from = this.state;
    if (from === to) return;
    this.state = to;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    if (to === "open") this.openedAt = Date.now();
    for (const listener of this.listeners) listener({ from, to, reason });
  }

  get upstreamName(): string {
    return this.name;
  }
}
