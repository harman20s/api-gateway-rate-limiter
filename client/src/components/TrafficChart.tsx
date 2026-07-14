import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { GatewayEvent } from "../types";

interface Props {
  feed: GatewayEvent[];
}

interface Bucket {
  label: string;
  ts: number;
  allowed: number;
  blocked: number;
}

const BUCKET_MS = 1000;
const BUCKET_COUNT = 30;

export function TrafficChart({ feed }: Props) {
  const [buckets, setBuckets] = useState<Bucket[]>([]);

  useEffect(() => {
    const now = Date.now();
    const bucketMap = new Map<number, Bucket>();

    for (let i = BUCKET_COUNT - 1; i >= 0; i--) {
      const bucketTs = Math.floor((now - i * BUCKET_MS) / BUCKET_MS) * BUCKET_MS;
      bucketMap.set(bucketTs, {
        label: new Date(bucketTs).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
        ts: bucketTs,
        allowed: 0,
        blocked: 0,
      });
    }

    for (const event of feed) {
      if (event.type !== "traffic") continue;
      const bucketTs = Math.floor(event.ts / BUCKET_MS) * BUCKET_MS;
      const bucket = bucketMap.get(bucketTs);
      if (!bucket) continue;
      if (event.allowed) bucket.allowed += 1;
      else bucket.blocked += 1;
    }

    setBuckets([...bucketMap.values()]);
  }, [feed]);

  return (
    <div className="panel">
      <h2>Live Traffic</h2>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={buckets}>
          <defs>
            <linearGradient id="allowedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4ade80" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="blockedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f87171" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
          <XAxis dataKey="label" stroke="#8888a0" fontSize={11} minTickGap={30} />
          <YAxis stroke="#8888a0" fontSize={11} allowDecimals={false} />
          <Tooltip contentStyle={{ background: "#1a1a24", border: "1px solid #333", borderRadius: 8 }} />
          <Area type="monotone" dataKey="allowed" stroke="#4ade80" fill="url(#allowedGrad)" strokeWidth={2} name="Allowed" />
          <Area type="monotone" dataKey="blocked" stroke="#f87171" fill="url(#blockedGrad)" strokeWidth={2} name="Blocked" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
