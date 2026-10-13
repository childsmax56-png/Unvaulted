// Runs one scan shard end to end: claim → scan each tracker → notify → release.
import { SCAN_SLUGS, SHARD_SIZE, claimShard, releaseShard, scanSlug, type ChangeRow, type ScanResult } from './_core';
import { notifyFollowers } from './_notify';

export async function runShard(env: Env, origin: string, shard: number, force: boolean): Promise<{ shard: number; skipped?: boolean; results: ScanResult[]; notified: number }> {
  const now = Date.now();
  if (!(await claimShard(env.DB, shard, now, force))) return { shard, skipped: true, results: [], notified: 0 };
  const results: ScanResult[] = [];
  const rows: ChangeRow[] = [];
  let notified = 0;
  try {
    for (const slug of SCAN_SLUGS.slice(shard * SHARD_SIZE, (shard + 1) * SHARD_SIZE)) {
      try {
        const r = await scanSlug(env, origin, slug, now);
        results.push(r.result);
        rows.push(...r.rows);
      } catch (e) {
        results.push({ slug, status: `error: ${(e as Error).message}`, changes: 0 });
      }
    }
    if (rows.length) notified = (await notifyFollowers(env, rows, now)).notified;
  } finally {
    await releaseShard(env.DB, shard, Date.now());
  }
  return { shard, results, notified };
}
