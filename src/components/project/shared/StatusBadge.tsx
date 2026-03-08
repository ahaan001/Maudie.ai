interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'xs';
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  // Ingestion statuses
  pending:    { label: 'Pending',    color: 'var(--amber)',    bg: 'var(--amber-dim)' },
  processing: { label: 'Processing', color: 'var(--amber)',    bg: 'var(--amber-dim)' },
  completed:  { label: 'Completed',  color: 'var(--green-ok)', bg: 'var(--green-dim)' },
  failed:     { label: 'Failed',     color: 'var(--red-flag)', bg: 'var(--red-dim)' },
  // Draft statuses
  draft:       { label: 'Draft',       color: 'rgba(245,244,240,0.5)', bg: 'var(--surface-2)' },
  in_review:   { label: 'In Review',   color: 'var(--amber)',    bg: 'var(--amber-dim)' },
  approved:    { label: 'Approved',    color: 'var(--green-ok)', bg: 'var(--green-dim)' },
  rejected:    { label: 'Rejected',    color: 'var(--red-flag)', bg: 'var(--red-dim)' },
  // Review task statuses
  assigned:      { label: 'Assigned',      color: 'var(--teal)',  bg: 'var(--teal-dim)' },
  escalated:     { label: 'Escalated',     color: 'var(--red-flag)', bg: 'var(--red-dim)' },
  auto_approved: { label: 'Auto-approved', color: 'var(--green-ok)', bg: 'var(--green-dim)' },
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const cfg = STATUS_MAP[status] ?? { label: status, color: 'var(--off-white)', bg: 'var(--surface-2)' };
  const padding = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center rounded font-medium ${padding}`}
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}
