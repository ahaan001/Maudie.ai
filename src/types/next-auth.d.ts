import type { DefaultSession } from 'next-auth';
import type { OrgRole } from '@/lib/db/schema';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      userId: string;
      orgId: string | null;
      orgRole: OrgRole | null;
    };
  }
}
