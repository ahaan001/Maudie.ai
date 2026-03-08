import type { OrgRole } from '@/lib/db/schema';

export const ROLE_ORDER: Record<OrgRole, number> = {
  viewer: 0,
  reviewer: 1,
  engineer: 2,
  admin: 3,
  owner: 4,
};

export function hasRole(userRole: OrgRole | null | undefined, minRole: OrgRole): boolean {
  if (!userRole) return false;
  return (ROLE_ORDER[userRole] ?? -1) >= ROLE_ORDER[minRole];
}
