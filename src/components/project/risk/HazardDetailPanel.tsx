'use client';

import { useState, useRef } from 'react';
import type { RiskControl } from '@/lib/db/schema';
import { rprColor } from './RiskMatrix';

interface HazardDetail {
  id: string;
  number: number;
  description: string;
  harm?: string | null;
  hazardousSituation?: string | null;
  hazardCategory?: string | null;
  initialSeverity?: number | null;
  initialProbability?: number | null;
  initialRpr: number | null;
  residualSeverity?: number | null;
  residualProbability?: number | null;
  residualRpr: number | null;
  riskStatus: string;
  acceptability?: string | null;
  mitigationMeasures?: string[] | null;
  controls: RiskControl[];
}

interface HazardDetailPanelProps {
  hazard: HazardDetail;
  projectId: string;
  onClose: () => void;
  onUpdated: () => void;
}

const ACCEPT_COLORS: Record<string, string> = {
  acceptable: 'var(--green-ok)',
  alarp: 'var(--amber)',
  unacceptable: 'var(--red-flag)',
};

export function HazardDetailPanel({ hazard, projectId, onClose, onUpdated }: HazardDetailPanelProps) {
  const [riskStatus, setRiskStatus] = useState(hazard.riskStatus);
  const [suggestText, setSuggestText] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [addingControl, setAddingControl] = useState(false);
  const [newControl, setNewControl] = useState({ controlType: 'design', description: '', verificationMethod: '' });
  const [savingControl, setSavingControl] = useState(false);
  const suggestRef = useRef<HTMLPreElement>(null);

  async function patchHazard(updates: Record<string, unknown>) {
    await fetch(`/api/projects/${projectId}/risk/hazards/${hazard.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    onUpdated();
  }

  async function handleStatusChange(status: string) {
    setRiskStatus(status);
    await patchHazard({ riskStatus: status });
  }

  async function startSuggest() {
    setSuggestText('');
    setIsSuggesting(true);
    const res = await fetch(`/api/projects/${projectId}/risk/hazards/${hazard.id}/suggest`, { method: 'POST' });
    if (!res.body) { setIsSuggesting(false); return; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop() ?? '';
      for (const part of parts) {
        const line = part.startsWith('data: ') ? part.slice(6) : part;
        try {
          const evt = JSON.parse(line) as { type: string; content?: string };
          if (evt.type === 'chunk') {
            setSuggestText(t => t + (evt.content ?? ''));
            if (suggestRef.current) suggestRef.current.scrollTop = suggestRef.current.scrollHeight;
          } else if (evt.type === 'complete' || evt.type === 'error') {
            setIsSuggesting(false);
          }
        } catch { /* skip */ }
      }
    }
    setIsSuggesting(false);
  }

  async function saveControl() {
    if (!newControl.description) return;
    setSavingControl(true);
    await fetch(`/api/projects/${projectId}/risk/hazards/${hazard.id}/controls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        controlType: newControl.controlType,
        description: newControl.description,
        verificationMethod: newControl.verificationMethod || undefined,
      }),
    });
    setSavingControl(false);
    setAddingControl(false);
    setNewControl({ controlType: 'design', description: '', verificationMethod: '' });
    onUpdated();
  }

  async function deleteControl(controlId: string) {
    await fetch(`/api/projects/${projectId}/risk/hazards/${hazard.id}/controls/${controlId}`, { method: 'DELETE' });
    onUpdated();
  }

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, zIndex: 50,
      background: 'var(--navy-800, #111827)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(245,244,240,0.4)' }}>H{hazard.number}</span>
            {hazard.hazardCategory && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                background: 'rgba(0,212,180,0.1)', color: 'var(--teal)', border: '1px solid rgba(0,212,180,0.25)',
              }}>
                {hazard.hazardCategory.replace('_', ' ')}
              </span>
            )}
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--off-white)', lineHeight: 1.4 }}>
            {hazard.description}
          </p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(245,244,240,0.5)', cursor: 'pointer', fontSize: 16, padding: '2px 6px', flexShrink: 0 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Risk scores */}
        <Section title="Risk Profile">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RprChip label="Initial" rpr={hazard.initialRpr} s={hazard.initialSeverity} p={hazard.initialProbability} />
            <span style={{ color: 'rgba(245,244,240,0.4)', fontSize: 16 }}>→</span>
            <RprChip label="Residual" rpr={hazard.residualRpr} s={hazard.residualSeverity} p={hazard.residualProbability} />
            {hazard.acceptability && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                background: `color-mix(in srgb, ${ACCEPT_COLORS[hazard.acceptability] ?? 'gray'} 15%, transparent)`,
                color: ACCEPT_COLORS[hazard.acceptability] ?? 'var(--off-white)',
                border: `1px solid color-mix(in srgb, ${ACCEPT_COLORS[hazard.acceptability] ?? 'gray'} 30%, transparent)`,
                textTransform: 'capitalize',
              }}>
                {hazard.acceptability}
              </span>
            )}
          </div>
        </Section>

        {/* Harm & Situation */}
        {(hazard.harm || hazard.hazardousSituation) && (
          <Section title="Harm & Situation">
            {hazard.harm && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 10, color: 'rgba(245,244,240,0.4)', marginBottom: 2 }}>HARM</p>
                <p style={{ fontSize: 13, color: 'var(--off-white)' }}>{hazard.harm}</p>
              </div>
            )}
            {hazard.hazardousSituation && (
              <div>
                <p style={{ fontSize: 10, color: 'rgba(245,244,240,0.4)', marginBottom: 2 }}>HAZARDOUS SITUATION</p>
                <p style={{ fontSize: 13, color: 'var(--off-white)' }}>{hazard.hazardousSituation}</p>
              </div>
            )}
          </Section>
        )}

        {/* Status */}
        <Section title="Status">
          <select
            value={riskStatus}
            onChange={e => handleStatusChange(e.target.value)}
            style={{
              padding: '7px 10px', fontSize: 13,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--off-white)', width: '100%',
            }}
          >
            <option value="open">Open</option>
            <option value="mitigated">Mitigated</option>
            <option value="accepted">Accepted</option>
            <option value="transferred">Transferred</option>
          </select>
        </Section>

        {/* Risk Controls */}
        <Section title={`Risk Controls (${hazard.controls.length})`}>
          {hazard.controls.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {hazard.controls.map(c => (
                <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'capitalize', color: 'var(--teal)' }}>{c.controlType}</span>
                    <button onClick={() => deleteControl(c.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--red-flag)', cursor: 'pointer', fontSize: 11, padding: 0 }}>✕</button>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--off-white)', marginBottom: c.verificationMethod ? 4 : 0 }}>{c.description}</p>
                  {c.verificationMethod && (
                    <p style={{ fontSize: 11, color: 'rgba(245,244,240,0.45)' }}>Verify: {c.verificationMethod}</p>
                  )}
                  <span style={{
                    marginTop: 6, display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                    background: c.verificationStatus === 'verified' ? 'rgba(52,211,153,0.1)' : 'rgba(245,244,240,0.05)',
                    color: c.verificationStatus === 'verified' ? 'var(--green-ok)' : 'rgba(245,244,240,0.4)',
                    border: c.verificationStatus === 'verified' ? '1px solid rgba(52,211,153,0.25)' : '1px solid rgba(245,244,240,0.1)',
                    textTransform: 'capitalize',
                  }}>
                    {c.verificationStatus ?? 'pending'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'rgba(245,244,240,0.35)', marginBottom: 12 }}>No controls added yet.</p>
          )}

          {addingControl ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <select value={newControl.controlType} onChange={e => setNewControl(n => ({ ...n, controlType: e.target.value }))}
                style={miniInput}>
                <option value="design">Design measure</option>
                <option value="protective">Protective measure</option>
                <option value="information">Information for safety</option>
              </select>
              <input value={newControl.description} onChange={e => setNewControl(n => ({ ...n, description: e.target.value }))}
                placeholder="Control description *" style={miniInput} />
              <input value={newControl.verificationMethod} onChange={e => setNewControl(n => ({ ...n, verificationMethod: e.target.value }))}
                placeholder="Verification method (optional)" style={miniInput} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveControl} disabled={savingControl}
                  style={{ flex: 1, padding: '6px', background: 'var(--teal)', color: 'var(--navy)', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {savingControl ? 'Saving…' : 'Save Control'}
                </button>
                <button onClick={() => setAddingControl(false)}
                  style={{ padding: '6px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, color: 'var(--off-white)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingControl(true)}
              style={{ fontSize: 12, padding: '5px 12px', background: 'var(--teal-dim)', border: '1px solid var(--teal)', borderRadius: 5, color: 'var(--teal)', cursor: 'pointer' }}>
              + Add Control
            </button>
          )}
        </Section>

        {/* AI Suggest Mitigations */}
        <Section title="AI Mitigation Suggestions">
          <button
            onClick={startSuggest}
            disabled={isSuggesting}
            style={{
              fontSize: 12, padding: '6px 14px', marginBottom: 10,
              background: isSuggesting ? 'rgba(0,212,180,0.05)' : 'var(--teal-dim)',
              border: '1px solid var(--teal)', borderRadius: 5, color: 'var(--teal)',
              cursor: isSuggesting ? 'wait' : 'pointer',
            }}
          >
            {isSuggesting ? 'Generating…' : suggestText ? 'Regenerate' : 'AI Suggest Mitigations'}
          </button>

          {(suggestText || isSuggesting) && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px' }}>
              <pre
                ref={suggestRef}
                style={{
                  fontSize: 12, color: 'var(--off-white)', whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--font-mono, monospace)', margin: 0,
                  maxHeight: 300, overflowY: 'auto', lineHeight: 1.6,
                }}
              >
                {suggestText}
                {isSuggesting && <span style={{ borderRight: '2px solid var(--teal)', animation: 'blink 1s step-end infinite', marginLeft: 1 }}>&nbsp;</span>}
              </pre>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(245,244,240,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function RprChip({ label, rpr, s, p }: { label: string; rpr: number | null; s?: number | null; p?: number | null }) {
  const color = rprColor(rpr);
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 9, color: 'rgba(245,244,240,0.4)', textTransform: 'uppercase', marginBottom: 3 }}>{label}</p>
      <div style={{
        padding: '6px 12px', borderRadius: 6, minWidth: 60, textAlign: 'center',
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}>
        <p style={{ fontSize: 18, fontWeight: 700, color, margin: 0 }}>{rpr ?? '—'}</p>
        {s && p && <p style={{ fontSize: 9, color: 'rgba(245,244,240,0.4)', margin: 0 }}>{s}×{p}</p>}
      </div>
    </div>
  );
}

const miniInput: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 12,
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 5, color: 'var(--off-white)', boxSizing: 'border-box',
};
