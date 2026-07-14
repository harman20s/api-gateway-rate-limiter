import { useState } from "react";
import { API_BASE } from "../api";

const CLIENT_IDS = ["flood-a", "flood-b", "flood-c"];
const TOTAL_REQUESTS = 150;
const CONCURRENCY = 20;

export function FloodButton() {
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function flood() {
    setRunning(true);
    setLastResult(null);
    const counts: Record<string, number> = {};
    let sent = 0;

    while (sent < TOTAL_REQUESTS) {
      const batchSize = Math.min(CONCURRENCY, TOTAL_REQUESTS - sent);
      const batch = Array.from({ length: batchSize }, (_, i) => {
        const clientId = CLIENT_IDS[(sent + i) % CLIENT_IDS.length];
        return fetch(`${API_BASE}/api/users/whoami`, { headers: { "x-client-id": clientId } })
          .then((r) => r.status)
          .catch(() => -1);
      });
      const results = await Promise.all(batch);
      for (const status of results) {
        const key = String(status);
        counts[key] = (counts[key] ?? 0) + 1;
      }
      sent += batchSize;
    }

    setLastResult(
      Object.entries(counts)
        .sort()
        .map(([status, count]) => `${status}: ${count}`)
        .join("  ")
    );
    setRunning(false);
  }

  return (
    <div className="panel flood-panel">
      <h2>Load Test</h2>
      <p className="muted">
        Fires {TOTAL_REQUESTS} requests at {CONCURRENCY} concurrency across {CLIENT_IDS.length} simulated clients to trigger rate
        limiting live.
      </p>
      <button className="btn-primary" onClick={flood} disabled={running}>
        {running ? "Flooding…" : "Flood Traffic"}
      </button>
      {lastResult && <div className="flood-result">{lastResult}</div>}
    </div>
  );
}
