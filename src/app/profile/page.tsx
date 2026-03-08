'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Sidebar } from '@/components/layout/Sidebar';
import { User, Building2, Shield, Calendar, LogOut, Mail } from 'lucide-react';

interface ProfileData {
  name: string | null;
  email: string | null;
  createdAt: string | null;
  org: { name: string; createdAt: string | null } | null;
  role: string | null;
  joinedAt: string | null;
}

const ROLE_LABELS: Record<string, { label: string; description: string; color: string }> = {
  owner:    { label: 'Owner',    description: 'Full access — owns the organization and all projects.', color: 'var(--amber)' },
  admin:    { label: 'Admin',    description: 'Manage team members, create projects, approve documents.', color: '#a78bfa' },
  engineer: { label: 'Engineer', description: 'Create and manage projects, upload documents, generate drafts.', color: 'var(--teal)' },
  reviewer: { label: 'Reviewer', description: 'Review and approve generated drafts and risk files.', color: 'var(--green-ok)' },
  viewer:   { label: 'Viewer',   description: 'Read-only access to projects and documents.', color: 'rgba(245,244,240,0.5)' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then(data => { setProfile(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const name = profile?.name ?? session?.user?.name ?? session?.user?.email ?? 'User';
  const initials = name
    .split(' ')
    .map((p: string) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const roleInfo = profile?.role ? (ROLE_LABELS[profile.role] ?? null) : null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8" style={{ background: 'var(--background)' }}>
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <User className="h-6 w-6" style={{ color: 'var(--teal)' }} />
            <div>
              <p className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--teal)', opacity: 0.8 }}>
                maudie.ai
              </p>
              <h1 className="text-2xl" style={{ fontFamily: 'var(--font-instrument-serif)', color: 'var(--off-white)' }}>
                Your Profile
              </h1>
            </div>
          </div>

          {loading ? (
            <div className="text-sm" style={{ color: 'rgba(245,244,240,0.4)' }}>Loading…</div>
          ) : (
            <div className="space-y-4">

              {/* Avatar + name card */}
              <div
                className="rounded-xl p-6 flex items-center gap-5"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-semibold flex-shrink-0"
                  style={{ background: 'var(--teal-dim)', color: 'var(--teal)' }}
                >
                  {initials}
                </div>
                <div>
                  <h2 className="text-xl font-medium" style={{ color: 'var(--off-white)' }}>
                    {profile?.name ?? session?.user?.name ?? '—'}
                  </h2>
                  <p className="text-sm mt-0.5" style={{ color: 'rgba(245,244,240,0.5)' }}>
                    {profile?.email ?? session?.user?.email ?? '—'}
                  </p>
                  {roleInfo && (
                    <span
                      className="inline-block mt-2 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ background: `${roleInfo.color}22`, color: roleInfo.color, border: `1px solid ${roleInfo.color}44` }}
                    >
                      {roleInfo.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Details */}
              <div
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(245,244,240,0.4)' }}>
                    Account Details
                  </h3>
                </div>

                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  <DetailRow icon={Mail} label="Email" value={profile?.email ?? session?.user?.email ?? '—'} />
                  <DetailRow icon={Building2} label="Organization" value={profile?.org?.name ?? '—'} />
                  <DetailRow
                    icon={Shield}
                    label="Role"
                    value={roleInfo ? roleInfo.label : (profile?.role ?? '—')}
                    sub={roleInfo?.description}
                    valueColor={roleInfo?.color}
                  />
                  <DetailRow
                    icon={Calendar}
                    label="Member since"
                    value={formatDate(profile?.joinedAt ?? null)}
                  />
                  {profile?.org?.createdAt && (
                    <DetailRow
                      icon={Calendar}
                      label="Organization created"
                      value={formatDate(profile.org.createdAt)}
                    />
                  )}
                </div>
              </div>

              {/* Sign out */}
              <div
                className="rounded-xl p-5"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(245,244,240,0.4)' }}>
                  Session
                </h3>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ border: '1px solid var(--red-flag)', color: 'var(--red-flag)', background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--red-dim)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  sub,
  valueColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-start gap-4 px-6 py-4">
      <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'rgba(245,244,240,0.35)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium mb-0.5" style={{ color: 'rgba(245,244,240,0.45)' }}>{label}</p>
        <p className="text-sm" style={{ color: valueColor ?? 'var(--off-white)' }}>{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'rgba(245,244,240,0.35)' }}>{sub}</p>}
      </div>
    </div>
  );
}
