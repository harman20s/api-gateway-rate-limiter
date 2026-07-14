import { useEffect, useState } from "react";
import { fetchBreakers, setUpstreamFailRate, type BreakerStatus as BreakerStatusType } from "../api";

const UPSTREAM_PORTS: Record<string, number> = {
  "users-service": 4001,
  "orders-service": 4002,
};

const STATE_COLOR: Record<string, string> = {
  closed: "#4ade80",
  open: "#f87171",
  half_open: "#facc15",
};

interface Props {
  liveStates: Record<string, { state: string }>;
}

export function BreakerStatus({ liveStates }: Props) {
  const [breakers, setBreakers] = useState<BreakerStatusType[]>([]);
  const [failing, setFailing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchBreakers().then(setBreakers);
    const interval = setInterval(() => fetchBreakers().then(setBreakers), 3000);
    return () => clearInterval(interval);
  }, []);

  async function toggleFailure(name: string) {
    const port = UPSTREAM_PORTS[name];
    const next = !failing[name];
    await setUpstreamFailRate(port, next ? 1 : 0);
    setFailing((prev) => ({ ...prev, [name]: next }));
  }

  return (
    <div className="panel">
      <h2>Circuit Breakers</h2>
      <div className="breaker-list">
        {breakers.map((b) => {
          const state = liveStates[b.name]?.state ?? b.state;
          return (
            <div key={b.name} className="breaker-row">
              <span className="dot" style={{ background: STATE_COLOR[state] ?? "#888" }} />
              <div className="breaker-info">
                <strong>{b.name}</strong>
                <span className="muted">{b.routePrefix}</span>
              </div>
              <span className="breaker-state">{state.replace("_", " ")}</span>
              <button className="btn-sm" onClick={() => toggleFailure(b.name)}>
                {failing[b.name] ? "Stop failing" : "Force fail"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
