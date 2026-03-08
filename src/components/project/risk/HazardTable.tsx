'use client';

import { useState } from 'react';
import type { RiskControl } from '@/lib/db/schema';
import { rprColor } from './RiskMatrix';

interface HazardRow {
  id: string;
  number: number;
  description: string;
  hazardCategory?: string | null;
  harm?: string | null;
  initialSeverity?: number | null;
  initialProbability?: number | null;
  initialRpr: number | null;
  residualSeverity?: number | null;
  residualProbability?: number | null;
  residualRpr: number | null;
  riskStatus: string;
  acceptability?: string | null;
  controls: RiskControl[];
}

interface HazardTableProps {
  hazards: HazardRow[];
  projectId: string;
  onHazardClick: (id: string) => void;
  onEditHazard: (hazard: HazardRow) => void;
  onDeleteHazard: (id: string) => void;
  onControlAdded: () => void;
}

type SortKey = 'number' | 'initialRpr' | 'residualRpr' | 'riskStatus' | 'acceptability';

const STATUS_COLORS: Record<string, string> = {
  open: 'var(--red-flag)',
  mitigated: 'var(--green-ok)',
  accepted: 'var(--amber)',
  transferred: 'rgba(245,244,240,0.5)',
};

const ACCEPT_COLORS: Record<string, string> = {
  acceptable: 'var(--green-ok)',
  alarp: 'var(--amber)',
  unacceptable: 'var(--red-flag)',
};

export function HazardTable({ hazards, projectId, onHazardClick, onEditHazard, onDeleteHazard, onControlAdded }: HazardTableProps) {
  const [sortBy, setSortBy] = useState<SortKey>('number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addControlFor, setAddControlFor] = useState<string | null>(null);
  const [newControl, setNewControl] = useState({ controlType: 'design', description: '', verificationMethod: '' });
  const [savingControl, setSavingControl] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('asc'); }
  }

  const filtered = hazards
    .filter(h => !filterCategory || h.hazardCategory === filterCategory)
    .filter(h => !filterStatus || h.riskStatus === filterStatus)
    .filter(h => !search || h.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let av: number | string = a[sortBy] ?? 0;
      let bv: number | string = b[sortBy] ?? 0;
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

  async function saveControl(hazardId: string) {
    if (!newControl.description) return;
    setSavingControl(true);
    await fetch(`/api/projects/${projectId}/risk/hazards/${hazardId}/controls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        controlType: newControl.controlType,
        description: newControl.description,
        verificationMethod: newControl.verificationMethod || undefined,
      }),
    });
    setSavingControl(false);
    setAddControlFor(null);
    setNewControl({ controlType: 'design', description: '', verificationMethod: '' });
    onControlAdded();
  }

  async function deleteControl(hazardId: string, controlId: string) {
    await fetch(`/api/projects/${projectId}/risk/hazards/${hazardId}/controls/${controlId}`, { method: 'DELETE' });
    onControlAdded();
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 12px', textAlign: 'left',
    fontSize: 10, fontWeight: 700, color: 'rgba(245,244,240,0.4)',
    letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer',
    userSelect: 'none', whiteSpace: 'nowrap',
  };

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search description…"
          style={{ padding: '6px 10px', fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--off-white)', width: 200 }}
        />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--off-white)' }}>
          <option value="">All categories</option>
          {['mechanical','electrical','thermal','software','use_error','biological'].map(c => (
            <option key={c} value={c}>{c.replace('_',' ')}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--off-white)' }}>
          <option value="">All statuses</option>
          {['open','mitigated','accepted','transferred'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, color: 'rgba(245,244,240,0.4)', textAlign: 'center', padding: '32px 0' }}>
          No hazards match your filters.
        </p>
      ) : (
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {[
                  { key: 'number', label: '#' },
                  { key: 'description', label: 'Description', nosort: true },
                  { key: 'hazardCategory', label: 'Category', nosort: true },
                  { key: 'initialRpr', label: 'Init RPR' },
                  { key: 'residualRpr', label: 'Res RPR' },
                  { key: 'riskStatus', label: 'Status' },
                  { key: 'acceptability', label: 'Acceptability' },
                  { key: 'actions', label: '', nosort: true },
                ].map(col => (
                  <th key={col.key} style={thStyle}
                    onClick={() => !col.nosort && toggleSort(col.key as SortKey)}>
                    {col.label}
                    {!col.nosort && sortBy === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(h => (
                <>
                  <tr
                    key={h.id}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => setExpandedId(expandedId === h.id ? null : h.id)}
                  >
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(245,244,240,0.5)', width: 32 }}>
                      {h.number}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--off-white)', maxWidth: 240 }}>
                      <span
                        onClick={e => { e.stopPropagation(); onHazardClick(h.id); }}
                        style={{ cursor: 'pointer' }}
                      >
                        {h.description.length > 80 ? h.description.slice(0, 80) + '…' : h.description}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: 'rgba(245,244,240,0.5)' }}>
                      {h.hazardCategory?.replace('_', ' ') ?? '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {h.initialRpr ? (
                        <span style={{ fontSize: 13, fontWeight: 700, color: rprColor(h.initialRpr) }}>{h.initialRpr}</span>
                      ) : <span style={{ color: 'rgba(245,244,240,0.3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {h.residualRpr ? (
                        <span style={{ fontSize: 13, fontWeight: 700, color: rprColor(h.residualRpr) }}>{h.residualRpr}</span>
                      ) : <span style={{ color: 'rgba(245,244,240,0.3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge label={h.riskStatus} color={STATUS_COLORS[h.riskStatus] ?? 'rgba(245,244,240,0.5)'} />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {h.acceptability ? (
                        <Badge label={h.acceptability} color={ACCEPT_COLORS[h.acceptability] ?? 'rgba(245,244,240,0.5)'} />
                      ) : <span style={{ color: 'rgba(245,244,240,0.3)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => onEditHazard(h)} style={iconBtnStyle} title="Edit">✏️</button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete hazard "${h.description.slice(0,60)}…"?`)) onDeleteHazard(h.id);
                          }}
                          style={{ ...iconBtnStyle, color: 'var(--red-flag)' }}
                          title="Delete"
                        >✕</button>
                      </div>
                    </td>
                  </tr>

                  {expandedId === h.id && (
                    <tr key={`${h.id}-expanded`} style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                      <td colSpan={8} style={{ padding: '12px 16px' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(245,244,240,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
                          Risk Controls ({h.controls.length})
                        </p>

                        {h.controls.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                            {h.controls.map(c => (
                              <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)' }}>
                                <Badge label={c.controlType} color="var(--teal)" />
                                <p style={{ fontSize: 12, color: 'var(--off-white)', flex: 1 }}>{c.description}</p>
                                {c.verificationMethod && (
                                  <p style={{ fontSize: 11, color: 'rgba(245,244,240,0.4)' }}>Verify: {c.verificationMethod}</p>
                                )}
                                <button
                                  onClick={() => deleteControl(h.id, c.id)}
                                  style={{ background: 'none', border: 'none', color: 'var(--red-flag)', cursor: 'pointer', fontSize: 12, padding: '0 4px' }}
                                >✕</button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ fontSize: 12, color: 'rgba(245,244,240,0.35)', marginBottom: 10 }}>No controls added yet.</p>
                        )}

                        {addControlFor === h.id ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <select value={newControl.controlType}
                              onChange={e => setNewControl(n => ({ ...n, controlType: e.target.value }))}
                              style={{ ...miniInputStyle, width: 130 }}>
                              <option value="design">Design</option>
                              <option value="protective">Protective</option>
                              <option value="information">Information</option>
                            </select>
                            <input value={newControl.description}
                              onChange={e => setNewControl(n => ({ ...n, description: e.target.value }))}
                              placeholder="Control description…" style={{ ...miniInputStyle, flex: 1, minWidth: 200 }} />
                            <input value={newControl.verificationMethod}
                              onChange={e => setNewControl(n => ({ ...n, verificationMethod: e.target.value }))}
                              placeholder="Verification method (optional)" style={{ ...miniInputStyle, width: 180 }} />
                            <button onClick={() => saveControl(h.id)} disabled={savingControl}
                              style={{ padding: '5px 12px', background: 'var(--teal)', color: 'var(--navy)', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                              {savingControl ? 'Adding…' : 'Add'}
                            </button>
                            <button onClick={() => setAddControlFor(null)}
                              style={{ padding: '5px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, color: 'var(--off-white)', cursor: 'pointer' }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setAddControlFor(h.id)}
                            style={{ fontSize: 12, padding: '4px 12px', background: 'var(--teal-dim)', border: '1px solid var(--teal)', borderRadius: 5, color: 'var(--teal)', cursor: 'pointer' }}>
                            + Add Control
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
      background: `color-mix(in srgb, ${color} 15%, transparent)`,
      color, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      whiteSpace: 'nowrap', textTransform: 'capitalize',
    }}>
      {label.replace('_', ' ')}
    </span>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 13, color: 'rgba(245,244,240,0.5)', padding: '2px 4px',
};

const miniInputStyle: React.CSSProperties = {
  padding: '5px 8px', fontSize: 12,
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 5, color: 'var(--off-white)',
};
