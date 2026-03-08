'use client';

import { useTraceabilityMatrix } from '@/hooks/useTraceabilityMatrix';
import { getSectionMetadata } from '@/lib/section-metadata';
import { StatusBadge } from '../shared/StatusBadge';
import type { RegulatoryProfile } from '@/types/regulatory';

interface TraceabilityMatrixProps {
  projectId: string;
  regulatoryProfile: RegulatoryProfile;
}

function EvidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'var(--green-ok)' : pct >= 40 ? 'var(--amber)' : 'var(--red-flag)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 10, color, fontWeight: 600, width: 28, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

export function TraceabilityMatrix({ projectId, regulatoryProfile }: TraceabilityMatrixProps) {
  const { data, isLoading } = useTraceabilityMatrix(projectId);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <p style={{ fontSize: 13, color: 'rgba(245,244,240,0.4)' }}>Loading traceability data…</p>
      </div>
    );
  }

  if (!data || data.sections.length === 0) {
    return (
      <div style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '48px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(245,244,240,0.6)', marginBottom: 8 }}>No drafts generated yet</p>
        <p style={{ fontSize: 12, color: 'rgba(245,244,240,0.35)' }}>
          Generate drafts first to see the traceability matrix.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Export button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          onClick={() => window.open(`/api/projects/${projectId}/traceability-matrix?format=csv`)}
          style={{
            fontSize: 12, fontWeight: 600, padding: '6px 14px',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 6, color: 'var(--off-white)', cursor: 'pointer',
          }}
        >
          ↓ Export CSV
        </button>
      </div>

      {/* Matrix table */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <th style={{
                padding: '10px 14px', textAlign: 'left', fontWeight: 700,
                fontSize: 10, color: 'rgba(245,244,240,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase',
                position: 'sticky', left: 0, background: 'var(--surface-2)', zIndex: 1,
                minWidth: 180, borderRight: '1px solid var(--border)',
              }}>
                Section
              </th>
              {data.allDocuments.map(doc => (
                <th key={doc.documentId} style={{
                  padding: '10px 10px', textAlign: 'center', fontWeight: 600,
                  fontSize: 10, color: 'rgba(245,244,240,0.5)',
                  maxWidth: 120, minWidth: 80,
                  borderRight: '1px solid var(--border)',
                }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }} title={doc.documentName}>
                    {doc.documentName}
                  </div>
                </th>
              ))}
              <th style={{
                padding: '10px 14px', textAlign: 'left', fontWeight: 700,
                fontSize: 10, color: 'rgba(245,244,240,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase',
                minWidth: 120,
              }}>
                Evidence
              </th>
            </tr>
          </thead>
          <tbody>
            {data.sections.map((row, i) => (
              <tr key={row.draftId} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                <td style={{
                  padding: '10px 14px',
                  position: 'sticky', left: 0, background: i % 2 === 0 ? 'var(--surface)' : 'rgba(20,24,36,0.98)',
                  zIndex: 1, borderRight: '1px solid var(--border)',
                }}>
                  <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 600, color: 'var(--off-white)' }}>
                    {row.sectionTitle}
                  </div>
                  <StatusBadge status={row.status} size="xs" />
                </td>
                {data.allDocuments.map(doc => {
                  const count = row.byDocument.find(d => d.documentId === doc.documentId)?.citationCount ?? 0;
                  const intensity = count > 0 ? Math.min(count / 10, 0.7) : 0;
                  return (
                    <td key={doc.documentId} style={{
                      padding: '10px 10px', textAlign: 'center',
                      background: count > 0 ? `rgba(0,188,180,${intensity})` : 'rgba(239,68,68,0.05)',
                      borderRight: '1px solid var(--border)',
                    }}>
                      <span style={{ fontSize: 12, fontWeight: count > 0 ? 700 : 400, color: count > 0 ? 'var(--off-white)' : 'rgba(245,244,240,0.2)' }}>
                        {count > 0 ? count : '—'}
                      </span>
                    </td>
                  );
                })}
                <td style={{ padding: '10px 14px' }}>
                  <EvidenceBar value={row.evidenceStrength} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Coverage Gaps */}
      {data.coverageGaps.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--red-flag)', marginBottom: 12 }}>
            Coverage Gaps ({data.coverageGaps.length}) — Sections with no draft
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.coverageGaps.map(gap => (
              <div key={gap} style={{
                padding: '6px 12px', borderRadius: 6,
                border: '1px solid var(--red-flag)',
                background: 'rgba(239,68,68,0.06)',
                fontSize: 12, color: 'rgba(245,244,240,0.7)',
              }}>
                {getSectionMetadata(gap).title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: 20, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(0,188,180,0.4)' }} />
          <span style={{ fontSize: 11, color: 'rgba(245,244,240,0.4)' }}>Citations present</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.3)' }} />
          <span style={{ fontSize: 11, color: 'rgba(245,244,240,0.4)' }}>No citations from this source</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 40, height: 6, borderRadius: 3, background: 'var(--green-ok)' }} />
          <span style={{ fontSize: 11, color: 'rgba(245,244,240,0.4)' }}>Evidence strength</span>
        </div>
      </div>
    </div>
  );
}
