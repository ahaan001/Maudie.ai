interface RiskBadgeProps {
  riskLevel: string;
  size?: 'sm' | 'xs';
}

const RISK_MAP: Record<string, { label: string; color: string; bg: string }> = {
  low:    { label: 'Low',    color: 'var(--green-ok)', bg: 'var(--green-dim)' },
  medium: { label: 'Medium', color: 'var(--amber)',    bg: 'var(--amber-dim)' },
  high:   { label: 'High',   color: 'var(--red-flag)', bg: 'var(--red-dim)' },
};

export function RiskBadge({ riskLevel, size = 'sm' }: RiskBadgeProps) {
  const cfg = RISK_MAP[riskLevel] ?? { label: riskLevel, color: 'var(--off-white)', bg: 'var(--surface-2)' };
  const padding = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center rounded font-semibold ${padding}`}
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.label} risk
    </span>
  );
}
