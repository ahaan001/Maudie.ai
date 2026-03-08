'use client';

import { useState, useEffect } from 'react';

const SEVERITY_LABELS: Record<number, string> = {
  1: '1 — Negligible', 2: '2 — Minor', 3: '3 — Serious', 4: '4 — Critical', 5: '5 — Catastrophic',
};
const PROB_LABELS: Record<number, string> = {
  1: '1 — Rare', 2: '2 — Unlikely', 3: '3 — Occasional', 4: '4 — Probable', 5: '5 — Frequent',
};

function acceptabilityFromRpr(s: number, p: number): { label: string; color: string } {
  const rpr = s * p;
  if (rpr <= 4) return { label: `RPR ${rpr} — Acceptable`, color: 'var(--green-ok)' };
  if (rpr <= 9) return { label: `RPR ${rpr} — ALARP`, color: 'var(--amber)' };
  return { label: `RPR ${rpr} — Unacceptable`, color: 'var(--red-flag)' };
}

interface HazardData {
  id: string;
  description: string;
  harm?: string | null;
  hazardousSituation?: string | null;
  hazardCategory?: string | null;
  initialSeverity?: number | null;
  initialProbability?: number | null;
  riskStatus?: string;
}

interface AddHazardModalProps {
  projectId: string;
  hazard?: HazardData;
  onClose: () => void;
  onSaved: () => void;
}

export function AddHazardModal({ projectId, hazard, onClose, onSaved }: AddHazardModalProps) {
  const [description, setDescription] = useState(hazard?.description ?? '');
  const [harm, setHarm] = useState(hazard?.harm ?? '');
  const [hazardousSituation, setHazardousSituation] = useState(hazard?.hazardousSituation ?? '');
  const [hazardCategory, setHazardCategory] = useState(hazard?.hazardCategory ?? '');
  const [initialSeverity, setInitialSeverity] = useState<number>(hazard?.initialSeverity ?? 0);
  const [initialProbability, setInitialProbability] = useState<number>(hazard?.initialProbability ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const preview = initialSeverity && initialProbability
    ? acceptabilityFromRpr(initialSeverity, initialProbability)
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const body = {
      description,
      harm: harm || undefined,
      hazardousSituation: hazardousSituation || undefined,
      hazardCategory: hazardCategory || undefined,
      initialSeverity: initialSeverity || undefined,
      initialProbability: initialProbability || undefined,
    };

    const url = hazard
      ? `/api/projects/${projectId}/risk/hazards/${hazard.id}`
      : `/api/projects/${projectId}/risk/hazards`;
    const method = hazard ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json() as { error?: string };
      setError(data.error ?? 'Failed to save hazard');
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 24, width: 480, maxWidth: '95vw', maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--off-white)', marginBottom: 16 }}>
          {hazard ? 'Edit Hazard' : 'Add Hazard'}
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Description *">
            <textarea
              required value={description} onChange={e => setDescription(e.target.value)}
              rows={3} placeholder="Describe the hazard..."
              style={inputStyle}
            />
          </Field>

          <Field label="Harm">
            <input value={harm} onChange={e => setHarm(e.target.value)}
              placeholder="Potential harm to patient or user" style={inputStyle} />
          </Field>

          <Field label="Hazardous Situation">
            <input value={hazardousSituation} onChange={e => setHazardousSituation(e.target.value)}
              placeholder="Circumstances leading to harm" style={inputStyle} />
          </Field>

          <Field label="Category">
            <select value={hazardCategory} onChange={e => setHazardCategory(e.target.value)} style={inputStyle}>
              <option value="">— Select category —</option>
              <option value="mechanical">Mechanical</option>
              <option value="electrical">Electrical</option>
              <option value="thermal">Thermal</option>
              <option value="software">Software</option>
              <option value="use_error">Use Error</option>
              <option value="biological">Biological</option>
            </select>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Initial Severity">
              <select value={initialSeverity} onChange={e => setInitialSeverity(Number(e.target.value))} style={inputStyle}>
                <option value={0}>— Select —</option>
                {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{SEVERITY_LABELS[v]}</option>)}
              </select>
            </Field>
            <Field label="Initial Probability">
              <select value={initialProbability} onChange={e => setInitialProbability(Number(e.target.value))} style={inputStyle}>
                <option value={0}>— Select —</option>
                {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{PROB_LABELS[v]}</option>)}
              </select>
            </Field>
          </div>

          {preview && (
            <div style={{
              padding: '8px 12px', borderRadius: 6,
              background: `color-mix(in srgb, ${preview.color} 10%, transparent)`,
              border: `1px solid color-mix(in srgb, ${preview.color} 30%, transparent)`,
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: preview.color }}>{preview.label}</span>
            </div>
          )}

          {error && <p style={{ fontSize: 12, color: 'var(--red-flag)' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
            <button type="submit" disabled={loading} style={saveBtnStyle}>
              {loading ? 'Saving…' : hazard ? 'Save Changes' : 'Add Hazard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: 'rgba(245,244,240,0.6)', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 6, color: 'var(--off-white)', boxSizing: 'border-box',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '7px 16px', background: 'var(--surface-2)',
  border: '1px solid var(--border)', borderRadius: 6,
  fontSize: 13, color: 'var(--off-white)', cursor: 'pointer',
};

const saveBtnStyle: React.CSSProperties = {
  padding: '7px 16px', background: 'var(--teal)', color: 'var(--navy)',
  border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
