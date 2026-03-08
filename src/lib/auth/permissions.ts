import type { OrgRole } from '@/lib/db/schema';
import { auth } from './config';
import { db } from '../db/client';
import { projects } from '../db/schema';
import { eq } from 'drizzle-orm';

export { hasRole } from './roles';

/** Get session or return null (no auth required). */
export async function getSession() {
  const session = await auth();
  if (!session?.user?.userId) return null;
  return session;
}

/** Get session or return a 401 Response. For use with try/catch in route handlers. */
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return session;
}

/** Verify the project belongs to the user's org. Throws 404 or 403 Response if not. */
export async function requireProjectAccess(
  projectId: string,
  session: Awaited<ReturnType<typeof requireSession>>,
) {
  const [project] = await db
    .select({ orgId: projects.orgId })
    .from(projects)
    .where(eq(projects.id, projectId as `${string}-${string}-${string}-${string}-${string}`))
    .limit(1);

  if (!project) {
    throw new Response(JSON.stringify({ error: 'Project not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (project.orgId !== session.user.orgId) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Call at the top of any /api/projects/[id]/* route handler.
 * Returns the session after verifying project ownership.
 * Throws a Response on auth failure (catch and return it).
 */
export async function requireProjectSession(projectId: string) {
  const session = await requireSession();
  await requireProjectAccess(projectId, session);
  return session;
}
