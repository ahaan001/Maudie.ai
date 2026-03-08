'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Shield,
  ShieldAlert,
  ClipboardCheck,
  ScrollText,
  LogOut,
  Users,
  BarChart2,
} from 'lucide-react';
import { MaudieLogo } from './MaudieLogo';
import { UserGuide } from '@/components/onboarding/UserGuide';
import { hasRole } from '@/lib/auth/roles';
import type { OrgRole } from '@/lib/db/schema';

interface NavItem {
  label: string;
  href: string;
  hash?: string; // expected hash when on the unified project page
  icon: React.ElementType;
}

interface SidebarProps {
  projectId?: string;
}

export function Sidebar({ projectId }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [currentHash, setCurrentHash] = useState('');

  useEffect(() => {
    setCurrentHash(window.location.hash);
    const onHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const isAdmin = hasRole((session?.user?.orgRole as OrgRole | null | undefined), 'admin');

  const globalNav: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Projects', href: '/projects', icon: FolderOpen },
    { label: 'Analytics', href: '/analytics', icon: BarChart2 },
    ...(isAdmin ? [{ label: 'Team', href: '/settings/team', icon: Users }] : []),
  ];

  const unifiedBase = projectId ? `/projects/${projectId}` : '';

  const projectNav: NavItem[] = projectId
    ? [
        { label: 'Overview',     href: `${unifiedBase}#overview`,     hash: '#overview',     icon: FolderOpen },
        { label: 'Documents',    href: `${unifiedBase}#documents`,    hash: '#documents',    icon: FileText },
        { label: 'Intelligence', href: `${unifiedBase}#intelligence`, hash: '#intelligence', icon: Shield },
        { label: 'Risk File',    href: `${unifiedBase}#risk`,         hash: '#risk',         icon: ShieldAlert },
        { label: 'Drafts',       href: `${unifiedBase}#drafts`,       hash: '#drafts',       icon: ScrollText },
        { label: 'Review Queue', href: `${unifiedBase}#review`,       hash: '#review',       icon: ClipboardCheck },
        { label: 'Audit Trail',  href: `${unifiedBase}#audit`,        hash: '#audit',        icon: ScrollText },
      ]
    : [];

  const isOnUnifiedPage = projectId ? pathname === `/projects/${projectId}` : false;

  const isActive = (item: NavItem) => {
    if (item.hash && isOnUnifiedPage) {
      // On the unified page: match by hash. Default to overview when no hash.
      const effectiveHash = currentHash || '#overview';
      return effectiveHash === item.hash;
    }
    // Global nav or fallback: match by pathname
    return pathname === item.href || (item.href !== '/projects' && pathname.startsWith(item.href + '/'));
  };

  // User initials avatar
  const name = session?.user?.name ?? session?.user?.email ?? 'U';
  const initials = name
    .split(' ')
    .map((part: string) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <aside
      className="flex flex-col min-h-screen flex-shrink-0"
      style={{
        width: 220,
        background: 'var(--navy)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Logo */}
      <div
        className="px-5 py-5 flex items-center gap-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="pulse-teal">
          <MaudieLogo height={26} />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-4 pb-2 space-y-0.5">
        {globalNav.map(item => (
          <NavLink key={item.href} item={item} active={isActive(item)} />
        ))}

        {projectNav.length > 0 && (
          <>
            <div className="pt-5 pb-2">
              <p
                className="text-[10px] font-semibold uppercase tracking-widest px-3"
                style={{ color: 'rgba(245,244,240,0.3)' }}
              >
                Current Project
              </p>
            </div>
            {projectNav.map(item => (
              <NavLink key={item.href} item={item} active={isActive(item)} />
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div
        className="px-3 py-4 space-y-1"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        {session?.user && (
          <Link
            href="/profile"
            className="flex items-center gap-3 px-3 py-2 mb-1 rounded-lg transition-colors"
            style={{ color: 'inherit', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
              style={{ background: 'var(--teal-dim)', color: 'var(--teal)' }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--off-white)' }}>
                {session.user.name ?? session.user.email}
              </p>
              <p className="text-[10px] truncate" style={{ color: 'rgba(245,244,240,0.35)' }}>
                View profile
              </p>
            </div>
          </Link>
        )}
        <UserGuide />
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
          style={{ color: 'rgba(245,244,240,0.4)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--off-white)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,244,240,0.4)')}
        >
          <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all relative"
      style={{
        color: active ? 'var(--off-white)' : 'rgba(245,244,240,0.45)',
        background: active ? 'var(--surface-2)' : 'transparent',
        borderLeft: active ? '2px solid var(--teal)' : '2px solid transparent',
        paddingLeft: active ? 'calc(0.75rem - 2px)' : '0.75rem',
      }}
    >
      <item.icon className="h-4 w-4 flex-shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}
