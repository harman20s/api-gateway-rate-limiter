import express from "express";

/**
 * Spins up a mock backend service on its own port. Supports two query params
 * for demoing the gateway's resilience features:
 *   ?failRate=0.5   -> respond 500 for ~50% of requests
 *   ?latencyMs=300  -> add artificial delay before responding
 * Toggle failure mode at runtime via POST /_control/fail-rate.
 */
export function startSampleService(name: string, port: number): void {
  const app = express();
  app.use(express.json());

  let failRate = 0;
  let baseLatencyMs = 20;

  app.post("/_control/fail-rate", (req, res) => {
    failRate = Number(req.body?.failRate ?? 0);
    res.json({ name, failRate });
  });

  app.post("/_control/latency", (req, res) => {
    baseLatencyMs = Number(req.body?.latencyMs ?? 20);
    res.json({ name, baseLatencyMs });
  });

  app.get("/health", (_req, res) => res.json({ name, status: "ok" }));

  app.get("*", async (_req, res) => {
    const jitter = Math.random() * 40;
    await new Promise((resolve) => setTimeout(resolve, baseLatencyMs + jitter));

    if (Math.random() < failRate) {
      res.status(500).json({ name, error: "simulated upstream failure" });
      return;
    }

    res.json({ name, ok: true, ts: Date.now() });
  });

  app.listen(port, () => {
    console.log(`[upstream:${name}] listening on http://localhost:${port}`);
  });
}
