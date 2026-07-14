export type GatewayEvent =
  | {
      type: "traffic";
      ts: number;
      clientId: string;
      upstream: string;
      allowed: boolean;
      limiterType: string;
      statusCode?: number;
      latencyMs?: number;
    }
  | { type: "breaker_state"; ts: number; upstream: string; from: string; to: string; reason: string }
  | { type: "stats"; ts: number; allowed: number; blocked: number; windowMs: number };
