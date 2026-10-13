// POST /api/changes/scan?shard=N  (or ?shard=all)
//
// Called by the changes-cron Worker (workers/changes-cron) with the shared
// CHANGES_CRON_SECRET. ?shard=all scans every shard in one call — fine for a
// manual kick, but the Worker calls shards one at a time to stay well inside
// the per-invocation subrequest limit.
import { json } from '../_auth';
import { ensureChangeTables, SHARD_COUNT } from './_core';
import { runShard } from './_run';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const secret = env.CHANGES_CRON_SECRET;
  if (!secret || request.headers.get('x-cron-secret') !== secret) return json({ error: 'Unauthorized' }, 401);
  await ensureChangeTables(env.DB);

  const url = new URL(request.url);
  const param = url.searchParams.get('shard') ?? '';
  const shards = param === 'all'
    ? Array.from({ length: SHARD_COUNT }, (_, i) => i)
    : [Number(param)];
  if (shards.some((s) => !Number.isInteger(s) || s < 0 || s >= SHARD_COUNT)) {
    return json({ error: `shard must be 0..${SHARD_COUNT - 1} or "all"`, shardCount: SHARD_COUNT }, 400);
  }
  const out = [];
  // Authenticated scans skip the "recently scanned" check (the lock still applies).
  for (const s of shards) out.push(await runShard(env, url.origin, s, true));
  return json({ shardCount: SHARD_COUNT, shards: out });
};
