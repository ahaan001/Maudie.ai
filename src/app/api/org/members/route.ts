import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { organizationMembers, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireSession, hasRole } from '@/lib/auth/permissions';

export async function GET() {
  try {
    let session;
    try {
      session = await requireSession();
    } catch (res) {
      return res as Response;
    }

    if (!hasRole(session.user.orgRole, 'admin')) {
      return NextResponse.json({ error: 'Forbidden: admin or owner required' }, { status: 403 });
    }

    const orgId = session.user.orgId!;

    const members = await db
      .select({
        memberId: organizationMembers.id,
        role: organizationMembers.role,
        joinedAt: organizationMembers.joinedAt,
        userId: users.id,
        name: users.name,
        email: users.email,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.orgId, orgId as `${string}-${string}-${string}-${string}-${string}`));

    return NextResponse.json({ members });
  } catch (err) {
    console.error('[GET /api/org/members]', err);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}
