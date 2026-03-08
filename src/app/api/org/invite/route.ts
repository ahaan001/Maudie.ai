import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { invitations, organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { requireSession, hasRole } from '@/lib/auth/permissions';
import { orgRoles } from '@/lib/db/schema';

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(orgRoles),
});

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const parsed = InviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const { email, role } = parsed.data;
    const orgId = session.user.orgId!;

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(invitations).values({
      orgId: orgId as `${string}-${string}-${string}-${string}-${string}`,
      email,
      role,
      token,
      invitedBy: session.user.userId as `${string}-${string}-${string}-${string}-${string}`,
      expiresAt,
    });

    const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const inviteUrl = `${appUrl}/auth/invite/${token}`;

    // Send email via Resend if configured
    if (process.env.RESEND_API_KEY) {
      const [org] = await db.select({ name: organizations.name }).from(organizations)
        .where(eq(organizations.id, orgId as `${string}-${string}-${string}-${string}-${string}`)).limit(1);

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM ?? 'noreply@maudie.ai',
          to: email,
          subject: `You've been invited to join ${org?.name ?? 'maudie.ai'}`,
          html: `<p>You've been invited to join <strong>${org?.name ?? 'maudie.ai'}</strong> as a <strong>${role}</strong>.</p>
                 <p><a href="${inviteUrl}">Accept invitation</a></p>
                 <p>This link expires in 7 days.</p>`,
        }),
      });

      return NextResponse.json({ success: true });
    }

    // No email configured — return the invite URL for manual sharing
    return NextResponse.json({ success: true, inviteUrl });
  } catch (err) {
    console.error('[POST /api/org/invite]', err);
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
  }
}
