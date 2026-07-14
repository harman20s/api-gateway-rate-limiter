import { CircuitBreaker } from "../circuitBreaker/circuitBreaker.js";

export interface UpstreamConfig {
  name: string;
  routePrefix: string;
  target: string;
}

export const upstreams: UpstreamConfig[] = [
  { name: "users-service", routePrefix: "/api/users", target: "http://localhost:4001" },
  { name: "orders-service", routePrefix: "/api/orders", target: "http://localhost:4002" },
];

export const breakers = new Map<string, CircuitBreaker>(
  upstreams.map((u) => [
    u.name,
    new CircuitBreaker(u.name, {
      failureThreshold: 5,
      resetTimeoutMs: 10_000,
      successThreshold: 2,
    }),
  ])
);
