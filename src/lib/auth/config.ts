import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { db } from '../db/client';
import { users, organizations, organizationMembers } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import type { OrgRole } from '../db/schema';

function hashPassword(password: string): string {
  return createHash('sha256').update(password + (process.env.AUTH_SECRET ?? 'fallback')).digest('hex');
}

/** Fetch a user's orgId and orgRole from the DB. */
async function getOrgContext(userId: string) {
  const [member] = await db
    .select({ orgId: organizationMembers.orgId, role: organizationMembers.role })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId as `${string}-${string}-${string}-${string}-${string}`))
    .limit(1);
  return { orgId: member?.orgId ?? null, orgRole: (member?.role ?? null) as OrgRole | null };
}

const googleProvider = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
  : [];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    ...googleProvider,
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const emailStr = (credentials?.email as string | undefined)?.trim().toLowerCase() ?? '';
        const passwordStr = (credentials?.password as string | undefined) ?? '';

        if (!emailStr || !passwordStr) {
          console.warn('[auth] authorize: missing email or password');
          return null;
        }

        let user: typeof users.$inferSelect | undefined;
        try {
          const rows = await db.select().from(users).where(eq(users.email, emailStr)).limit(1);
          user = rows[0];
        } catch (dbErr) {
          console.error('[auth] authorize: DB lookup failed', dbErr);
          return null;
        }

        if (!user) {
          console.warn('[auth] authorize: no user found for email', emailStr);
          return null;
        }

        const hash = hashPassword(passwordStr);
        if (hash !== user.passwordHash) {
          console.warn('[auth] authorize: password mismatch for', emailStr);
          return null;
        }

        const { orgId, orgRole } = await getOrgContext(user.id);
        console.info('[auth] authorize: success for', emailStr, '| role:', orgRole ?? 'none');

        return { id: user.id, email: user.email, name: user.name, orgId, orgRole };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // On Google sign-in: create user + org if this is their first time
      if (account?.provider === 'google') {
        const email = user.email?.trim().toLowerCase();
        if (!email) return false;

        try {
          const [existing] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (!existing) {
            // First Google sign-in: create org + user + membership
            await db.transaction(async (tx) => {
              const orgName = user.name ? `${user.name}'s Organization` : 'My Organization';
              const [org] = await tx.insert(organizations).values({ name: orgName }).returning();
              const [newUser] = await tx
                .insert(users)
                .values({
                  name: user.name ?? email,
                  email,
                  passwordHash: '', // No password for OAuth-only users
                  orgId: org.id,
                  role: 'owner',
                })
                .returning();
              await tx.insert(organizationMembers).values({
                orgId: org.id,
                userId: newUser.id,
                role: 'owner',
              });
            });
            console.info('[auth] Google signIn: created new user for', email);
          } else {
            console.info('[auth] Google signIn: existing user for', email);
          }
        } catch (err) {
          console.error('[auth] Google signIn: DB error', err);
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, account }) {
      // Credentials login: user object has our custom fields
      if (user && account?.provider === 'credentials') {
        token.userId = user.id;
        token.orgId = (user as typeof user & { orgId: string | null }).orgId;
        token.orgRole = (user as typeof user & { orgRole: OrgRole | null }).orgRole;
      }

      // Google login: look up our DB user by email to get orgId/orgRole
      if (account?.provider === 'google' && token.email) {
        try {
          const email = token.email.trim().toLowerCase();
          const [dbUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
          if (dbUser) {
            token.userId = dbUser.id;
            const { orgId, orgRole } = await getOrgContext(dbUser.id);
            token.orgId = orgId;
            token.orgRole = orgRole;
          }
        } catch (err) {
          console.error('[auth] jwt Google lookup failed', err);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.userId = token.userId as string;
        session.user.orgId = (token.orgId ?? null) as string | null;
        session.user.orgRole = (token.orgRole ?? null) as OrgRole | null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
});
