import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { organizationMembers } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireSession, hasRole } from '@/lib/auth/permissions';
import { orgRoles } from '@/lib/db/schema';
import type { OrgRole } from '@/lib/db/schema';

const PatchSchema = z.union([
  z.object({ role: z.enum(orgRoles) }),
  z.object({ action: z.literal('remove') }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
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

    const { userId } = await params;
    const orgId = session.user.orgId!;

    // Cannot modify self
    if (userId === session.user.userId) {
      return NextResponse.json({ error: 'Cannot modify your own membership' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    // Fetch target member to check their role
    const [target] = await db.select().from(organizationMembers)
      .where(and(
        eq(organizationMembers.orgId, orgId as `${string}-${string}-${string}-${string}-${string}`),
        eq(organizationMembers.userId, userId as `${string}-${string}-${string}-${string}-${string}`),
      )).limit(1);

    if (!target) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Admins cannot modify owners
    if (target.role === 'owner' && session.user.orgRole !== 'owner') {
      return NextResponse.json({ error: 'Only owners can modify other owners' }, { status: 403 });
    }

    if ('action' in parsed.data && parsed.data.action === 'remove') {
      await db.delete(organizationMembers).where(and(
        eq(organizationMembers.orgId, orgId as `${string}-${string}-${string}-${string}-${string}`),
        eq(organizationMembers.userId, userId as `${string}-${string}-${string}-${string}-${string}`),
      ));
      return NextResponse.json({ success: true });
    }

    if ('role' in parsed.data) {
      await db.update(organizationMembers)
        .set({ role: parsed.data.role as OrgRole })
        .where(and(
          eq(organizationMembers.orgId, orgId as `${string}-${string}-${string}-${string}-${string}`),
          eq(organizationMembers.userId, userId as `${string}-${string}-${string}-${string}-${string}`),
        ));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'No valid action provided' }, { status: 400 });
  } catch (err) {
    console.error('[PATCH /api/org/members/[userId]]', err);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }
}
