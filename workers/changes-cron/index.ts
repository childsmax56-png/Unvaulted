// Every 15 minutes: scan each tracker shard via the Pages app. Shards run one
// request at a time so each Pages invocation stays well inside its subrequest
// and CPU limits.
interface Env {
  SITE_ORIGIN: string;
  CHANGES_CRON_SECRET: string;
}

async function scan(env: Env, shard: number | 'all'): Promise<any> {
  const res = await fetch(`${env.SITE_ORIGIN}/api/changes/scan?shard=${shard}`, {
    method: 'POST',
    headers: { 'x-cron-secret': env.CHANGES_CRON_SECRET },
  });
  return res.json().catch(() => ({ status: res.status }));
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      // Shard 0 also reports how many shards there are.
      const first = await scan(env, 0);
      const count: number = first?.shardCount ?? 0;
      for (let i = 1; i < count; i++) {
        try { await scan(env, i); } catch (e) { console.error(`shard ${i}`, e); }
      }
    })());
  },
};
