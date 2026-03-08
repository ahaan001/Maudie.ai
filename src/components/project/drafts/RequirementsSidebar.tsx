'use client';

import { CheckCircle, Clock, Circle } from 'lucide-react';
import type { RequirementWithMeta } from '@/lib/section-metadata';

interface RequirementsSidebarProps {
  requirements: RequirementWithMeta[];
  onGenerate: (sectionKey: string) => void;
  generatingKey?: string | null;
}

function StatusIcon({ status }: { status: RequirementWithMeta['status'] }) {
  if (status === 'approved') return <CheckCircle size={14} style={{ color: 'var(--green-ok)', flexShrink: 0 }} />;
  if (status === 'in_progress') return <Clock size={14} className="animate-pulse" style={{ color: 'var(--amber)', flexShrink: 0 }} />;
  return <Circle size={14} style={{ color: 'rgba(245,244,240,0.25)', flexShrink: 0 }} />;
}

export function RequirementsSidebar({ requirements, onGenerate, generatingKey }: RequirementsSidebarProps) {
  const incomplete = requirements.filter(r => r.status !== 'approved');

  return (
    <div
      style={{
        width: 256,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        borderLeft: '1px solid var(--border)',
        paddingLeft: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--off-white)', margin: 0 }}>What&apos;s Next</p>
        {incomplete.length > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '1px 7px',
              borderRadius: 999,
              background: 'rgba(255,184,0,0.15)',
              color: 'var(--amber)',
            }}
          >
            {incomplete.length}
          </span>
        )}
      </div>

      {incomplete.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <CheckCircle size={24} style={{ color: 'var(--green-ok)', margin: '0 auto 8px' }} />
          <p style={{ fontSize: 12, color: 'rgba(245,244,240,0.5)', margin: 0 }}>
            All required sections complete
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 320px)',
          }}
        >
          {incomplete.map(req => (
            <div
              key={req.section_key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 6,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
              }}
            >
              <StatusIcon status={req.status} />
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'rgba(245,244,240,0.8)', lineHeight: 1.3 }}>
                {req.title}
              </span>
              {req.status === 'not_started' && (
                <button
                  onClick={() => onGenerate(req.section_key)}
                  disabled={generatingKey === req.section_key}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: generatingKey === req.section_key
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(0,188,180,0.15)',
                    color: generatingKey === req.section_key
                      ? 'rgba(245,244,240,0.3)'
                      : 'var(--teal)',
                    border: '1px solid transparent',
                    cursor: generatingKey === req.section_key ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap' as const,
                    flexShrink: 0,
                  }}
                >
                  {generatingKey === req.section_key ? '...' : 'Generate'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
