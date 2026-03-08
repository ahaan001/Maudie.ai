'use client';

interface Summary {
  total: number;
  open: number;
  mitigated: number;
  accepted: number;
  transferred: number;
  unacceptable: number;
  highestUnmitigatedRpr: number;
}

interface RiskSummaryCardProps {
  summary: Summary;
}

export function RiskSummaryCard({ summary }: RiskSummaryCardProps) {
  const closedCount = summary.mitigated + summary.accepted + summary.transferred;
  const completeness = summary.total > 0 ? Math.round((closedCount / summary.total) * 100) : 0;

  const stats = [
    {
      label: 'Completeness',
      value: `${completeness}%`,
      sub: `${closedCount} of ${summary.total} hazards resolved`,
      color: completeness === 100 ? 'var(--green-ok)' : completeness >= 50 ? 'var(--amber)' : 'var(--red-flag)',
    },
    {
      label: 'Open Hazards',
      value: String(summary.open),
      sub: summary.open === 0 ? 'All resolved' : 'Require mitigation',
      color: summary.open > 0 ? 'var(--red-flag)' : 'var(--green-ok)',
    },
    {
      label: 'Highest RPR (open)',
      value: summary.highestUnmitigatedRpr > 0 ? String(summary.highestUnmitigatedRpr) : '—',
      sub: summary.highestUnmitigatedRpr >= 10 ? 'Unacceptable — action needed' : summary.highestUnmitigatedRpr >= 5 ? 'ALARP zone' : 'Acceptable',
      color: summary.highestUnmitigatedRpr >= 10 ? 'var(--red-flag)' : summary.highestUnmitigatedRpr >= 5 ? 'var(--amber)' : 'var(--green-ok)',
    },
    {
      label: 'Mitigated / Accepted',
      value: `${summary.mitigated} / ${summary.accepted}`,
      sub: `${summary.transferred} transferred`,
      color: 'var(--teal)',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
      {stats.map(stat => (
        <div
          key={stat.label}
          style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '14px 16px',
          }}
        >
          <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(245,244,240,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
            {stat.label}
          </p>
          <p style={{ fontSize: 22, fontWeight: 700, color: stat.color, marginBottom: 4 }}>
            {stat.value}
          </p>
          <p style={{ fontSize: 11, color: 'rgba(245,244,240,0.45)' }}>{stat.sub}</p>
        </div>
      ))}
    </div>
  );
}
