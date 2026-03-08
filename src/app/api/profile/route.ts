import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/permissions';

export async function GET() {
  try {
    let session;
    try {
      session = await requireSession();
    } catch (res) {
      return res as Response;
    }

    const userId = session.user.userId as `${string}-${string}-${string}-${string}-${string}`;
    const orgId = session.user.orgId as `${string}-${string}-${string}-${string}-${string}` | null;

    const [user] = await db
      .select({ name: users.name, email: users.email, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    let org: { name: string; createdAt: Date | null } | null = null;
    let membership: { role: string; joinedAt: Date | null } | null = null;

    if (orgId) {
      const [orgRow] = await db
        .select({ name: organizations.name, createdAt: organizations.createdAt })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);
      org = orgRow ?? null;

      const [memberRow] = await db
        .select({ role: organizationMembers.role, joinedAt: organizationMembers.joinedAt })
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, userId))
        .limit(1);
      membership = memberRow ?? null;
    }

    return NextResponse.json({
      name: user?.name ?? null,
      email: user?.email ?? session.user.email ?? null,
      createdAt: user?.createdAt ?? null,
      org: org ? { name: org.name, createdAt: org.createdAt } : null,
      role: membership?.role ?? session.user.orgRole ?? null,
      joinedAt: membership?.joinedAt ?? null,
    });
  } catch (err) {
    console.error('[GET /api/profile]', err);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
