import type { GatewayEvent } from "../types";

interface Props {
  feed: GatewayEvent[];
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour12: false });
}

export function LiveFeed({ feed }: Props) {
  return (
    <div className="panel feed-panel">
      <h2>Live Event Feed</h2>
      <div className="feed-list">
        {feed.length === 0 && <div className="muted">Waiting for traffic…</div>}
        {feed.map((event, i) => {
          if (event.type === "traffic") {
            return (
              <div key={i} className={`feed-row ${event.allowed ? "ok" : "blocked"}`}>
                <span className="feed-time">{formatTime(event.ts)}</span>
                <span className="feed-badge">{event.allowed ? "ALLOW" : "BLOCK"}</span>
                <span>{event.clientId}</span>
                <span className="muted">→ {event.upstream}</span>
                <span className="muted">{event.limiterType}</span>
              </div>
            );
          }
          if (event.type === "breaker_state") {
            return (
              <div key={i} className="feed-row breaker">
                <span className="feed-time">{formatTime(event.ts)}</span>
                <span className="feed-badge breaker-badge">BREAKER</span>
                <span>
                  {event.upstream}: {event.from} → {event.to}
                </span>
                <span className="muted">{event.reason}</span>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
