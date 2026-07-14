export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";
export const WS_URL = API_BASE.replace(/^http/, "ws") + "/ws";

export interface BreakerStatus {
  name: string;
  routePrefix: string;
  state: "closed" | "open" | "half_open";
}

export interface TrafficStats {
  allowed: number;
  blocked: number;
  windowMs: number;
}

export async function fetchBreakers(): Promise<BreakerStatus[]> {
  const res = await fetch(`${API_BASE}/admin/breakers`);
  return res.json();
}

export async function fetchStats(windowMs = 10_000): Promise<TrafficStats> {
  const res = await fetch(`${API_BASE}/admin/stats?windowMs=${windowMs}`);
  return res.json();
}

export async function setUpstreamFailRate(port: number, failRate: number): Promise<void> {
  await fetch(`http://localhost:${port}/_control/fail-rate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ failRate }),
  });
}
