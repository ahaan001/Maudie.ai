import { AlertTriangle, AlertCircle } from 'lucide-react';
import type { RedFlag } from '@/hooks/useReviewTasks';

interface FlagsListProps {
  flags: RedFlag[];
}

export function FlagsList({ flags }: FlagsListProps) {
  if (!flags || flags.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'rgba(245,244,240,0.35)' }}>
        No flags detected.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {flags.map((flag, i) => (
        <div
          key={i}
          className="flex items-start gap-2 px-3 py-2 rounded-lg"
          style={{
            background: flag.severity === 'error' ? 'var(--red-dim)' : 'var(--amber-dim)',
            border: `1px solid ${flag.severity === 'error' ? 'rgba(224,82,82,0.2)' : 'rgba(245,166,35,0.2)'}`,
          }}
        >
          {flag.severity === 'error' ? (
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--red-flag)' }} />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--amber)' }} />
          )}
          <div className="min-w-0">
            <p
              className="text-xs font-medium"
              style={{ color: flag.severity === 'error' ? 'var(--red-flag)' : 'var(--amber)' }}
            >
              {flag.type.replace(/_/g, ' ')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(245,244,240,0.6)' }}>
              {flag.description}
            </p>
            {flag.location && (
              <p className="text-[10px] mt-0.5 font-mono" style={{ color: 'rgba(245,244,240,0.35)' }}>
                {flag.location}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
