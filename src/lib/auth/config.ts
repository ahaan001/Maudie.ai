import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '../db/client';
import { users, organizationMembers } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import type { OrgRole } from '../db/schema';

function hashPassword(password: string): string {
  return createHash('sha256').update(password + (process.env.AUTH_SECRET ?? 'fallback')).digest('hex');
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const [user] = await db.select().from(users)
          .where(eq(users.email, credentials.email as string))
          .limit(1);

        if (!user) return null;

        const hash = hashPassword(credentials.password as string);
        if (hash !== user.passwordHash) return null;

        const [member] = await db.select().from(organizationMembers)
          .where(eq(organizationMembers.userId, user.id))
          .limit(1);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          orgId: member?.orgId ?? null,
          orgRole: (member?.role ?? null) as OrgRole | null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.orgId = (user as typeof user & { orgId: string | null }).orgId;
        token.orgRole = (user as typeof user & { orgRole: OrgRole | null }).orgRole;
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
