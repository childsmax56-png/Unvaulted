// Shared gate for the /admin dashboard endpoints (tracker health + dead links).
// Same moderator pool as community-tracker review: the site owners plus
// yeditsgold admins.
import { json } from '../_auth';
import { resolveUser, canModerate, type VGAuthUser } from '../community/_db';

export async function requireModerator(
  request: Request,
  env: Env,
): Promise<{ user: VGAuthUser } | { error: Response }> {
  const user = await resolveUser(request);
  if (!user) return { error: json({ error: 'Sign in required' }, 401) };
  if (!(await canModerate(env.DB, user))) return { error: json({ error: 'Forbidden' }, 403) };
  return { user };
}
