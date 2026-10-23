import { monitorEventLoopDelay } from 'node:perf_hooks';
import os from 'node:os';
import { getPool, getImportPool } from '@/lib/db';

// Every 15 s, one log line with event-loop lag, memory and DB pool state, so
// an overload shows what is saturating: GC/memory (heap/rss), CPU (lag with
// a normal heap) or the database (pool waiting while the loop is fine).
export function startHealthMonitor() {
  const loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  const mb = (n: number) => Math.round(n / 1048576);
  console.log(
    `[host] cpus=${os.cpus().length} mem=${mb(os.totalmem())}MB free=${mb(os.freemem())}MB load=${os.loadavg().map((l) => l.toFixed(1)).join('/')} uvThreads=${process.env.UV_THREADPOOL_SIZE || 4}`
  );
  setInterval(() => {
    const m = process.memoryUsage();
    const p = getPool();
    const ip = getImportPool();
    console.log(
      `[health] lag p50=${Math.round(loop.percentile(50) / 1e6)}ms p99=${Math.round(loop.percentile(99) / 1e6)}ms max=${Math.round(loop.max / 1e6)}ms` +
        ` | rss=${mb(m.rss)}MB heap=${mb(m.heapUsed)}/${mb(m.heapTotal)}MB ext=${mb(m.external)}MB buf=${mb(m.arrayBuffers)}MB` +
        ` | pool total=${p.totalCount} idle=${p.idleCount} waiting=${p.waitingCount}` +
        ` | import total=${ip.totalCount} waiting=${ip.waitingCount}` +
        ` | host load=${os.loadavg()[0].toFixed(1)} free=${mb(os.freemem())}MB`
    );
    loop.reset();
  }, 15_000).unref();
}
