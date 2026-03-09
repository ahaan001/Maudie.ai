import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { z } from 'zod';

const ResetSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

function hashPassword(password: string): string {
  return createHash('sha256').update(password + (process.env.AUTH_SECRET ?? 'fallback')).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ResetSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as string;
        if (field) fieldErrors[field] = issue.message;
      }
      return NextResponse.json({ error: 'Invalid request', fieldErrors }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const { newPassword } = parsed.data;

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Always return success to avoid email enumeration
    if (!existing) {
      return NextResponse.json({ success: true });
    }

    await db
      .update(users)
      .set({ passwordHash: hashPassword(newPassword) })
      .where(eq(users.email, email));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/auth/reset-password]', err);
    return NextResponse.json({ error: 'Failed to reset password. Please try again.' }, { status: 500 });
  }
}
