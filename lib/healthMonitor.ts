import { monitorEventLoopDelay } from 'node:perf_hooks';
import os from 'node:os';
import { getPool, getImportPool } from '@/lib/db';

// Every 15 s, one log line with event-loop lag, memory and DB pool state, so
// an overload shows what is saturating: GC/memory (heap/rss), CPU (lag with
// a normal heap) or the database (pool waiting while the loop is fine).
export function startHealthMonitor() {
  // Confirms the Postgres tuning (set in Coolify) is actually active
  getPool()
    .query(
      `SELECT string_agg(name || '=' || setting || COALESCE(unit, ''), ' ' ORDER BY name) AS s FROM pg_settings
       WHERE name IN ('shared_buffers','effective_cache_size','work_mem','maintenance_work_mem','max_connections',
                      'random_page_cost','jit','max_wal_size','dynamic_shared_memory_type','log_min_duration_statement')`
    )
    .then((r) => console.log(`[postgres] ${r.rows[0]?.s}`))
    .catch((e) => console.warn('[postgres] settings check failed:', e.message));

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
