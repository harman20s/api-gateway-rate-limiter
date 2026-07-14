import { useEffect, useRef, useState } from "react";
import { WS_URL } from "../api";
import type { GatewayEvent } from "../types";

const MAX_FEED_LENGTH = 100;

export interface GatewayEventsState {
  connected: boolean;
  feed: GatewayEvent[];
  breakerStates: Record<string, { state: string; lastChange?: GatewayEvent }>;
}

export function useGatewayEvents(): GatewayEventsState {
  const [connected, setConnected] = useState(false);
  const [feed, setFeed] = useState<GatewayEvent[]>([]);
  const [breakerStates, setBreakerStates] = useState<GatewayEventsState["breakerStates"]>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        retryTimer = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (event) => {
        const parsed: GatewayEvent = JSON.parse(event.data);
        setFeed((prev) => [parsed, ...prev].slice(0, MAX_FEED_LENGTH));

        if (parsed.type === "breaker_state") {
          setBreakerStates((prev) => ({
            ...prev,
            [parsed.upstream]: { state: parsed.to, lastChange: parsed },
          }));
        }
      };
    }

    connect();
    return () => {
      clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, []);

  return { connected, feed, breakerStates };
}
