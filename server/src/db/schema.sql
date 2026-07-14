CREATE TABLE IF NOT EXISTS traffic_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  client_id TEXT NOT NULL,
  upstream TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  allowed INTEGER NOT NULL,
  limiter_type TEXT NOT NULL,
  status_code INTEGER,
  latency_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_traffic_logs_ts ON traffic_logs (ts);
CREATE INDEX IF NOT EXISTS idx_traffic_logs_client ON traffic_logs (client_id);

CREATE TABLE IF NOT EXISTS rate_limit_configs (
  client_id TEXT PRIMARY KEY,
  algorithm TEXT NOT NULL DEFAULT 'token_bucket',
  capacity INTEGER NOT NULL DEFAULT 20,
  refill_per_sec REAL NOT NULL DEFAULT 5,
  window_ms INTEGER NOT NULL DEFAULT 1000,
  window_limit INTEGER NOT NULL DEFAULT 20
);

CREATE TABLE IF NOT EXISTS breaker_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  upstream TEXT NOT NULL,
  state TEXT NOT NULL,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_breaker_events_ts ON breaker_events (ts);
