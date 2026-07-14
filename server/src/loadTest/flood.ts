/**
 * Flood-test the gateway to demo rate limiting and circuit breaking live.
 * Usage: npm run flood -- --clients=5 --requests=200 --concurrency=20 --route=/api/users/whoami
 */
interface FloodOptions {
  clients: number;
  requests: number;
  concurrency: number;
  route: string;
  baseUrl: string;
}

function parseArgs(): FloodOptions {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [key, value] = arg.replace(/^--/, "").split("=");
      return [key, value];
    })
  );

  return {
    clients: Number(args.clients ?? 5),
    requests: Number(args.requests ?? 200),
    concurrency: Number(args.concurrency ?? 20),
    route: args.route ?? "/api/users/whoami",
    baseUrl: args.baseUrl ?? "http://localhost:4000",
  };
}

async function runBatch(urls: { url: string; clientId: string }[]): Promise<number[]> {
  return Promise.all(
    urls.map(async ({ url, clientId }) => {
      try {
        const res = await fetch(url, { headers: { "x-client-id": clientId } });
        return res.status;
      } catch {
        return -1;
      }
    })
  );
}

async function main() {
  const opts = parseArgs();
  const clientIds = Array.from({ length: opts.clients }, (_, i) => `flood-client-${i}`);
  const statusCounts = new Map<number, number>();

  let sent = 0;
  console.log(
    `Flooding ${opts.baseUrl}${opts.route} with ${opts.requests} requests across ${opts.clients} clients, concurrency ${opts.concurrency}`
  );

  while (sent < opts.requests) {
    const batchSize = Math.min(opts.concurrency, opts.requests - sent);
    const batch = Array.from({ length: batchSize }, (_, i) => ({
      url: `${opts.baseUrl}${opts.route}`,
      clientId: clientIds[(sent + i) % clientIds.length],
    }));

    const statuses = await runBatch(batch);
    for (const status of statuses) {
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    }
    sent += batchSize;
    process.stdout.write(`\r${sent}/${opts.requests} sent`);
  }

  console.log("\n\nResults:");
  for (const [status, count] of [...statusCounts.entries()].sort((a, b) => a[0] - b[0])) {
    const label = status === -1 ? "network error" : status;
    console.log(`  ${label}: ${count}`);
  }
}

main();
