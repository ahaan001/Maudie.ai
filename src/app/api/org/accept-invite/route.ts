import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { invitations, users, organizationMembers } from '@/lib/db/schema';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { createHash } from 'crypto';
import { z } from 'zod';
import type { OrgRole } from '@/lib/db/schema';

function hashPassword(password: string): string {
  return createHash('sha256').update(password + (process.env.AUTH_SECRET ?? 'fallback')).digest('hex');
}

/** GET /api/org/accept-invite?token= — returns invitation details for the accept page */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const [invite] = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
  }

  // Check if the email already has an account
  const [existingUser] = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, invite.email)).limit(1);

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    orgId: invite.orgId,
    isNewUser: !existingUser,
  });
}

const AcceptSchema = z.object({
  token: z.string(),
  name: z.string().min(1).optional(),
  password: z.string().min(8).optional(),
});

/** POST /api/org/accept-invite — accepts invite, creates user if new */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = AcceptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const { token, name, password } = parsed.data;

    const [invite] = await db.select().from(invitations)
      .where(and(
        eq(invitations.token, token),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, new Date()),
      ))
      .limit(1);

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
    }

    const orgId = invite.orgId as `${string}-${string}-${string}-${string}-${string}`;
    const role = invite.role as OrgRole;

    // Find or create user
    let [existingUser] = await db.select().from(users).where(eq(users.email, invite.email)).limit(1);

    if (!existingUser) {
      // New user — name + password required
      if (!name || !password) {
        return NextResponse.json({ error: 'name and password required for new users' }, { status: 400 });
      }
      const [created] = await db.insert(users).values({
        name,
        email: invite.email,
        passwordHash: hashPassword(password),
        orgId,
        role,
      }).returning();
      existingUser = created;
    } else {
      // Existing user — update their orgId if not already set
      if (!existingUser.orgId) {
        await db.update(users).set({ orgId, role }).where(eq(users.id, existingUser.id));
      }
    }

    // Add to org_members (upsert via conflict ignore is not in drizzle yet, so check first)
    const [alreadyMember] = await db.select({ id: organizationMembers.id }).from(organizationMembers)
      .where(and(
        eq(organizationMembers.orgId, orgId),
        eq(organizationMembers.userId, existingUser.id),
      )).limit(1);

    if (!alreadyMember) {
      await db.insert(organizationMembers).values({
        orgId,
        userId: existingUser.id,
        role,
        invitedBy: invite.invitedBy as `${string}-${string}-${string}-${string}-${string}`,
      });
    }

    // Mark invitation accepted
    await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.token, token));

    return NextResponse.json({ success: true, email: invite.email });
  } catch (err) {
    console.error('[POST /api/org/accept-invite]', err);
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
