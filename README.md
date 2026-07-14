# API Gateway Rate Limiter

A lightweight API gateway built from scratch — no Kong, no nginx wrapper — implementing
per-client rate limiting (two algorithms), a per-upstream circuit breaker, and a live
WebSocket dashboard for watching both in action in real time.

## Status: MVP complete and runnable

## Why this project

Most portfolio CRUD apps put the "hard part" in auth. This one puts it in **concurrency
correctness and failure handling**: rate limiters that must not race under concurrent
requests, and a circuit breaker that must transition `closed → open → half_open → closed`
correctly under real failure conditions — not just in theory, but demonstrably, with a
dashboard showing it happen and a flood-test button that proves it under load.

## Architecture

```
                      ┌─────────────────────────┐
  client requests ──▶ │   Gateway (Express)      │
                      │  ┌────────────────────┐  │      ┌──────────────────┐
                      │  │ Rate Limiter        │  │      │ users-service    │
                      │  │ (token bucket /      │──┼───▶ │ (mock upstream)  │
                      │  │  sliding window)     │  │      └──────────────────┘
                      │  └────────────────────┘  │
                      │  ┌────────────────────┐  │      ┌──────────────────┐
                      │  │ Circuit Breaker      │──┼───▶ │ orders-service   │
                      │  │ per upstream         │  │      │ (mock upstream)  │
                      │  └────────────────────┘  │      └──────────────────┘
                      │  ┌────────────────────┐  │
                      │  │ SQLite (traffic log, │  │
                      │  │ breaker events,      │  │
                      │  │ rate-limit configs)  │  │
                      │  └────────────────────┘  │
                      │  ┌────────────────────┐  │
                      │  │ WebSocket broadcaster│──┼──▶  React dashboard (live)
                      │  └────────────────────┘  │
                      └─────────────────────────┘
```

- **Rate limiting** (`server/src/rateLimiter/`): token bucket (lazy refill, per-client)
  and sliding-window log (prunes expired timestamps per check — avoids the fixed-window
  boundary-burst problem). Selectable per client via the admin API.
- **Circuit breaker** (`server/src/circuitBreaker/`): one instance per upstream, with
  `closed`/`open`/`half_open` states, configurable failure threshold, reset timeout, and
  half-open success threshold before fully closing again.
- **Gateway proxy** (`server/src/gateway/proxy.ts`): routes `/api/users/*` and
  `/api/orders/*` to mock upstream services, gated by the breaker (fails fast with 503
  when open) and instrumented to feed the breaker success/failure signal from the
  *upstream's* actual response status.
- **Live dashboard** (`client/`): React + Recharts, connected over WebSocket, showing a
  rolling traffic chart (allowed vs. blocked), live circuit breaker state per upstream,
  a scrolling event feed, and a **Flood Traffic** button that fires 150 concurrent
  requests from the browser to trigger rate limiting live.
- **Persistence**: Node's built-in `node:sqlite` (no native build step required) for
  traffic logs, breaker state-change events, and per-client rate-limit configs. The query
  layer (`server/src/db/queries.ts`) is written async-first so swapping to Postgres for a
  real deployment only touches that one file, not call sites.

### A concurrency note

`RateLimiter.check()` never awaits, so within a single Node process the
read-modify-write on a client's bucket/window is atomic per event-loop turn — there's no
interleaving window for a race. That guarantee breaks the moment this state is shared
across processes (cluster mode, PM2, multiple gateway instances behind a load balancer),
which is why production deployments move this state into Redis with `INCR`+`EXPIRE` or a
Lua script to keep the check atomic across processes. Documented in
`server/src/rateLimiter/tokenBucket.ts`.

## Project structure

```
server/
  src/
    db/              SQLite pool, schema, async query layer
    rateLimiter/      Token bucket + sliding window implementations
    circuitBreaker/   Per-upstream circuit breaker
    gateway/          Upstream registry + proxy routing
    middleware/        Rate-limit Express middleware
    routes/            Admin API (stats, breakers, configs)
    upstreamServices/  Mock backend services with controllable failure rate/latency
    ws/                WebSocket broadcaster
    loadTest/          Flood-test CLI
    index.ts           Entrypoint — wires everything together
client/
  src/
    components/        TrafficChart, BreakerStatus, LiveFeed, FloodButton
    hooks/              useGatewayEvents (WebSocket client)
    api.ts              REST helpers
```

## Setup

Requires Node 22+ (uses the built-in `node:sqlite` module).

```bash
# Terminal 1 — gateway + mock upstreams + SQLite (all in one process)
cd server
npm install
npm run dev

# Terminal 2 — dashboard
cd client
npm install
npm run dev
```

Open the dashboard at `http://localhost:5173`. The gateway listens on `:4000`, mock
upstreams on `:4001` (users) and `:4002` (orders).

### Try it

- Click **Flood Traffic** in the dashboard to fire 150 requests and watch the traffic
  chart split into allowed (green) vs. blocked (red).
- Click **Force fail** next to an upstream to make it return HTTP 500s; after 5
  consecutive failures the breaker trips to `open` and the gateway starts fast-failing
  with 503 instead of hitting the upstream. Click again to stop failing and watch it
  recover through `half_open` back to `closed`.
- Or drive it from the CLI: `cd server && npm run flood -- --requests=200 --clients=5`

## Deploy notes

- Swap `node:sqlite` for Postgres by rewriting `server/src/db/queries.ts` only.
- Deploy the gateway + upstreams to Railway/Render/Fly.io, the dashboard to Vercel,
  pointing `VITE_API_BASE` at the deployed gateway URL.
- For a multi-instance gateway, move rate-limiter state to Redis (see the concurrency
  note above) — the in-memory implementation here is correct for a single process only.
