interface SkeletonCardProps {
  variant?: 'header' | 'card' | 'row' | 'timeline';
  count?: number;
}

export function SkeletonCard({ variant = 'card' }: SkeletonCardProps) {
  const base = 'animate-pulse rounded-lg';
  const styles: Record<string, string> = {
    header: 'h-16 w-full',
    card: 'h-36 w-full',
    row: 'h-10 w-full',
    timeline: 'h-14 w-full',
  };

  return (
    <div
      className={`${base} ${styles[variant]}`}
      style={{ background: 'var(--surface-2)' }}
    />
  );
}

export function SkeletonList({ count = 3, variant = 'row' }: { count?: number; variant?: 'header' | 'card' | 'row' | 'timeline' }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} variant={variant} />
      ))}
    </div>
  );
}
