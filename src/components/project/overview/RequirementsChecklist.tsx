'use client';

import { CheckCircle, Clock, Circle } from 'lucide-react';
import { StatusBadge } from '../shared/StatusBadge';
import type { RequirementWithMeta } from '@/lib/section-metadata';

interface RequirementsChecklistProps {
  grouped: Record<string, RequirementWithMeta[]>;
  isLoading?: boolean;
  projectId: string;
  onTabSwitch?: (tab: import('@/hooks/useProjectHash').TabId) => void;
}

function StatusIcon({ status }: { status: RequirementWithMeta['status'] }) {
  if (status === 'approved') return <CheckCircle size={16} style={{ color: 'var(--green-ok)', flexShrink: 0 }} />;
  if (status === 'in_progress') return <Clock size={16} className="animate-pulse" style={{ color: 'var(--amber)', flexShrink: 0 }} />;
  return <Circle size={16} style={{ color: 'rgba(245,244,240,0.25)', flexShrink: 0 }} />;
}

function StandardBadge({ standard }: { standard: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.04em',
        padding: '2px 6px',
        borderRadius: 4,
        background: 'rgba(0,188,180,0.12)',
        color: 'var(--teal)',
        border: '1px solid rgba(0,188,180,0.25)',
        whiteSpace: 'nowrap' as const,
      }}
    >
      {standard}
    </span>
  );
}

function statusToBadge(status: RequirementWithMeta['status']): string {
  if (status === 'approved') return 'approved';
  if (status === 'in_progress') return 'in_review';
  return 'pending';
}

export function RequirementsChecklist({ grouped, isLoading, projectId: _projectId, onTabSwitch }: RequirementsChecklistProps) {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse" style={{ height: 60, borderRadius: 8, background: 'var(--surface-2)' }} />
        ))}
      </div>
    );
  }

  const categories = Object.keys(grouped);
  if (categories.length === 0) {
    return (
      <p style={{ color: 'rgba(245,244,240,0.4)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
        No requirements found. Create a project with a regulatory profile to see requirements.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {categories.map(category => (
        <div key={category}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(245,244,240,0.4)', marginBottom: 10 }}>
            {category}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {grouped[category].map(req => (
              <div
                key={req.section_key}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ paddingTop: 2 }}>
                  <StatusIcon status={req.status} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--off-white)' }}>{req.title}</span>
                    <StatusBadge status={statusToBadge(req.status)} />
                  </div>
                  {req.applicable_standards.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
                      {req.applicable_standards.map(std => (
                        <StandardBadge key={std} standard={std} />
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {req.draft_id && (
                    <button
                      onClick={() => onTabSwitch?.('drafts')}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: 'rgba(0,188,180,0.12)',
                        color: 'var(--teal)',
                        border: '1px solid rgba(0,188,180,0.25)',
                        cursor: 'pointer',
                      }}
                    >
                      View Draft
                    </button>
                  )}
                  {req.status === 'not_started' && (
                    <button
                      onClick={() => onTabSwitch?.('drafts')}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: 'rgba(255,255,255,0.05)',
                        color: 'rgba(245,244,240,0.6)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                      }}
                    >
                      Generate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
