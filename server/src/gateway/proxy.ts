import type { Express, Request, Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { upstreams, breakers } from "./upstreams.js";
import { logBreakerEvent } from "../db/queries.js";
import type { Broadcaster } from "../ws/broadcaster.js";

export function mountGatewayRoutes(app: Express, broadcaster: Broadcaster): void {
  for (const upstream of upstreams) {
    const breaker = breakers.get(upstream.name)!;

    breaker.onStateChange(async (change) => {
      const ts = Date.now();
      await logBreakerEvent({ ts, upstream: upstream.name, state: change.to, reason: change.reason });
      broadcaster.broadcast({
        type: "breaker_state",
        ts,
        upstream: upstream.name,
        from: change.from,
        to: change.to,
        reason: change.reason,
      });
    });

    const proxy = createProxyMiddleware({
      target: upstream.target,
      changeOrigin: true,
      pathRewrite: { [`^${upstream.routePrefix}`]: "" },
      on: {
        proxyRes: (proxyRes) => {
          const status = proxyRes.statusCode;
          if (status && status < 500) {
            breaker.recordSuccess();
          } else {
            breaker.recordFailure();
          }
        },
        error: (_err, _req, res) => {
          breaker.recordFailure();
          if (res && "writeHead" in res && !(res as Response).headersSent) {
            (res as Response).writeHead(502, { "Content-Type": "application/json" });
            (res as Response).end(JSON.stringify({ error: "upstream error", upstream: upstream.name }));
          }
        },
      },
    });

    app.use(upstream.routePrefix, (req: Request, res: Response, next) => {
      if (!breaker.canRequest()) {
        res.status(503).json({ error: "circuit open", upstream: upstream.name });
        return;
      }
      proxy(req, res, next);
    });
  }
}
