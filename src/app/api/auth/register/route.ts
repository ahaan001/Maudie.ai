import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { z } from 'zod';

const RegisterSchema = z.object({
  name: z.string().min(1, 'Full name is required').max(100),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  orgName: z.string().min(1, 'Organization name is required').max(200),
});

function hashPassword(password: string): string {
  return createHash('sha256').update(password + (process.env.AUTH_SECRET ?? 'fallback')).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      // Map Zod errors to field-level messages
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as string;
        if (field) fieldErrors[field] = issue.message;
      }
      return NextResponse.json({ error: 'Invalid request', fieldErrors }, { status: 400 });
    }

    const { name, password, orgName } = parsed.data;
    const email = parsed.data.email.trim().toLowerCase();

    // Check email uniqueness before starting transaction
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: 'Email already in use', fieldErrors: { email: 'An account with this email already exists.' } },
        { status: 409 },
      );
    }

    // Create org + user + membership atomically
    await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({ name: orgName })
        .returning();

      const [user] = await tx
        .insert(users)
        .values({
          name,
          email,
          passwordHash: hashPassword(password),
          orgId: org.id,
          role: 'owner',
        })
        .returning();

      await tx.insert(organizationMembers).values({
        orgId: org.id,
        userId: user.id,
        role: 'owner',
      });
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/auth/register]', err);
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }
}
