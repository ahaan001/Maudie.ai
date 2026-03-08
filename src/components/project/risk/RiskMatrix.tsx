'use client';

import { useState } from 'react';

interface HazardPoint {
  id: string;
  number: number;
  description: string;
  severity: number | null;
  probability: number | null;
}

interface RiskMatrixProps {
  hazards: HazardPoint[];
  label: string;
  onHazardClick: (id: string) => void;
}

const SEVERITY_LABELS = ['', 'Negligible', 'Minor', 'Serious', 'Critical', 'Catastrophic'];
const PROB_LABELS = ['', 'Rare', 'Unlikely', 'Occasional', 'Probable', 'Frequent'];

function cellColor(s: number, p: number): string {
  const rpr = s * p;
  if (rpr <= 4) return 'rgba(52,211,153,0.15)';
  if (rpr <= 9) return 'rgba(245,166,35,0.15)';
  return 'rgba(224,82,82,0.15)';
}

function rprColor(rpr: number | null): string {
  if (!rpr) return 'rgba(245,244,240,0.3)';
  if (rpr <= 4) return 'var(--green-ok)';
  if (rpr <= 9) return 'var(--amber)';
  return 'var(--red-flag)';
}

export function RiskMatrix({ hazards, label, onHazardClick }: RiskMatrixProps) {
  const [tooltip, setTooltip] = useState<{ id: string; text: string } | null>(null);

  // Group hazards by cell (severity, probability)
  const cellMap = new Map<string, HazardPoint[]>();
  for (const h of hazards) {
    if (h.severity && h.probability) {
      const key = `${h.severity}-${h.probability}`;
      const list = cellMap.get(key) ?? [];
      list.push(h);
      cellMap.set(key, list);
    }
  }

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(245,244,240,0.5)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </p>

      <div style={{ display: 'flex', gap: 0 }}>
        {/* Y-axis label */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginRight: 6 }}>
          <p style={{
            fontSize: 9, color: 'rgba(245,244,240,0.4)', writingMode: 'vertical-rl',
            transform: 'rotate(180deg)', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap'
          }}>
            Severity →
          </p>
        </div>

        <div>
          {/* Matrix grid: rows top-to-bottom = severity 5→1 */}
          {[5, 4, 3, 2, 1].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
              {/* Row label */}
              <div style={{ width: 20, textAlign: 'right', marginRight: 4 }}>
                <span style={{ fontSize: 9, color: 'rgba(245,244,240,0.35)' }}>{s}</span>
              </div>

              {/* Cells for probability 1→5 */}
              {[1, 2, 3, 4, 5].map(p => {
                const key = `${s}-${p}`;
                const cellHazards = cellMap.get(key) ?? [];
                return (
                  <div
                    key={p}
                    style={{
                      width: 44, height: 44,
                      background: cellColor(s, p),
                      border: '1px solid rgba(255,255,255,0.06)',
                      position: 'relative',
                      display: 'flex', flexWrap: 'wrap',
                      alignContent: 'center', justifyContent: 'center',
                      gap: 2, padding: 2,
                    }}
                  >
                    {cellHazards.map(h => (
                      <div
                        key={h.id}
                        onClick={() => onHazardClick(h.id)}
                        onMouseEnter={() => setTooltip({ id: h.id, text: h.description })}
                        onMouseLeave={() => setTooltip(null)}
                        style={{
                          width: 18, height: 18, borderRadius: '50%',
                          background: 'var(--teal)', color: 'var(--navy)',
                          fontSize: 9, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', flexShrink: 0,
                          position: 'relative',
                          zIndex: 10,
                        }}
                      >
                        {h.number}
                        {tooltip?.id === h.id && (
                          <div style={{
                            position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
                            background: 'var(--surface-2)', border: '1px solid var(--border)',
                            borderRadius: 6, padding: '6px 8px', width: 160,
                            fontSize: 11, color: 'var(--off-white)', whiteSpace: 'normal', textAlign: 'left',
                            pointerEvents: 'none', zIndex: 100,
                          }}>
                            {h.description.length > 80 ? h.description.slice(0, 80) + '…' : h.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}

          {/* X-axis labels */}
          <div style={{ display: 'flex', marginLeft: 24, marginTop: 4 }}>
            {[1, 2, 3, 4, 5].map(p => (
              <div key={p} style={{ width: 44, textAlign: 'center' }}>
                <span style={{ fontSize: 9, color: 'rgba(245,244,240,0.35)' }}>{p}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 9, color: 'rgba(245,244,240,0.4)', letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 2, textAlign: 'center' }}>
            Probability →
          </p>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
        {[
          { color: 'rgba(52,211,153,0.4)', label: 'Acceptable (RPR ≤4)' },
          { color: 'rgba(245,166,35,0.4)', label: 'ALARP (5-9)' },
          { color: 'rgba(224,82,82,0.4)', label: 'Unacceptable (≥10)' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, border: '1px solid rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: 9, color: 'rgba(245,244,240,0.4)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { rprColor };
