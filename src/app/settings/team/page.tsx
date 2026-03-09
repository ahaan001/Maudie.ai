'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hasRole } from '@/lib/auth/roles';
import type { OrgRole } from '@/lib/db/schema';

interface Member {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  engineer: 'Engineer',
  reviewer: 'Reviewer',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'var(--teal)',
  admin: '#8b5cf6',
  engineer: 'var(--amber)',
  reviewer: 'var(--green-ok)',
  viewer: 'rgba(245,244,240,0.4)',
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
      background: `color-mix(in srgb, ${ROLE_COLORS[role] ?? 'gray'} 15%, transparent)`,
      color: ROLE_COLORS[role] ?? 'var(--off-white)',
      border: `1px solid color-mix(in srgb, ${ROLE_COLORS[role] ?? 'gray'} 30%, transparent)`,
    }}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrgRole>('engineer');
  const [error, setError] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/org/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json() as { error?: string; inviteUrl?: string };
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Failed to send invitation'); return; }
    if (data.inviteUrl) { setInviteUrl(data.inviteUrl); } else { onClose(); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 24, width: 380, maxWidth: '90vw',
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--off-white)', marginBottom: 16 }}>
          Invite team member
        </h3>

        {inviteUrl ? (
          <div>
            <p style={{ fontSize: 13, color: 'rgba(245,244,240,0.7)', marginBottom: 8 }}>
              No email provider configured. Share this link manually:
            </p>
            <input
              readOnly
              value={inviteUrl}
              onClick={e => (e.target as HTMLInputElement).select()}
              style={{
                width: '100%', padding: '8px 12px', fontSize: 12,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 6, color: 'var(--teal)', fontFamily: 'var(--font-mono)',
              }}
            />
            <button
              onClick={onClose}
              style={{
                marginTop: 12, width: '100%', padding: '8px 16px',
                background: 'var(--teal)', color: 'var(--navy)',
                border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: 'rgba(245,244,240,0.6)', display: 'block', marginBottom: 4 }}>
                Email address
              </label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                style={{
                  width: '100%', padding: '8px 12px', fontSize: 13,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--off-white)',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'rgba(245,244,240,0.6)', display: 'block', marginBottom: 4 }}>
                Role
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as OrgRole)}
                style={{
                  width: '100%', padding: '8px 12px', fontSize: 13,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--off-white)',
                }}
              >
                <option value="viewer">Viewer — read-only</option>
                <option value="reviewer">Reviewer — can approve drafts</option>
                <option value="engineer">Engineer — can generate, upload, edit</option>
                <option value="admin">Admin — manage members + all above</option>
              </select>
            </div>
            {error && <p style={{ fontSize: 12, color: 'var(--red-flag)' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button" onClick={onClose}
                style={{
                  padding: '7px 16px', background: 'var(--surface-2)',
                  border: '1px solid var(--border)', borderRadius: 6,
                  fontSize: 13, color: 'var(--off-white)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit" disabled={loading}
                style={{
                  padding: '7px 16px', background: 'var(--teal)', color: 'var(--navy)',
                  border: 'none', borderRadius: 6,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {loading ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { data: sessionData } = useSession();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);

  const myRole = sessionData?.user?.orgRole as OrgRole | null ?? null;
  const myUserId = sessionData?.user?.userId;
  const isAdmin = hasRole(myRole, 'admin');

  const { data, isLoading } = useQuery({
    queryKey: ['org-members'],
    queryFn: async () => {
      const res = await fetch('/api/org/members');
      if (!res.ok) throw new Error('Failed to fetch members');
      return res.json() as Promise<{ members: Member[] }>;
    },
    enabled: isAdmin,
  });

  const changeMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: OrgRole }) => {
      const res = await fetch(`/api/org/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Failed to update role');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-members'] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/org/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove' }),
      });
      if (!res.ok) throw new Error('Failed to remove member');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-members'] }),
  });

  if (!isAdmin) {
    return (
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--off-white)', marginBottom: 8 }}>Team</h1>
        <p style={{ fontSize: 14, color: 'rgba(245,244,240,0.5)' }}>Admin access required to manage team members.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--off-white)' }}>Team Members</h1>
        <button
          onClick={() => setInviteOpen(true)}
          style={{
            fontSize: 13, fontWeight: 600, padding: '7px 16px',
            background: 'var(--teal)', color: 'var(--navy)',
            border: 'none', borderRadius: 6, cursor: 'pointer',
          }}
        >
          + Invite Member
        </button>
      </div>

      {isLoading ? (
        <p style={{ fontSize: 13, color: 'rgba(245,244,240,0.5)' }}>Loading…</p>
      ) : (
        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Member', 'Email', 'Role', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left',
                    fontSize: 11, fontWeight: 700, color: 'rgba(245,244,240,0.4)',
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.members.map(member => {
                const isSelf = member.userId === myUserId;
                const canModify = isAdmin && !isSelf && !(member.role === 'owner' && myRole !== 'owner');
                return (
                  <tr key={member.memberId} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: 'var(--teal)',
                          flexShrink: 0,
                        }}>
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--off-white)' }}>
                          {member.name}{isSelf && ' (you)'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'rgba(245,244,240,0.6)' }}>
                      {member.email}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {canModify ? (
                        <select
                          value={member.role}
                          onChange={e => changeMutation.mutate({ userId: member.userId, role: e.target.value as OrgRole })}
                          style={{
                            fontSize: 12, padding: '3px 8px',
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 4, color: 'var(--off-white)',
                          }}
                        >
                          <option value="viewer">Viewer</option>
                          <option value="reviewer">Reviewer</option>
                          <option value="engineer">Engineer</option>
                          <option value="admin">Admin</option>
                          {myRole === 'owner' && <option value="owner">Owner</option>}
                        </select>
                      ) : (
                        <RoleBadge role={member.role} />
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'rgba(245,244,240,0.4)' }}>
                      {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {canModify && (
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${member.name} from the organization?`)) {
                              removeMutation.mutate(member.userId);
                            }
                          }}
                          style={{
                            fontSize: 12, padding: '4px 10px',
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.25)',
                            borderRadius: 4, color: 'var(--red-flag)', cursor: 'pointer',
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}
    </div>
  );
}
