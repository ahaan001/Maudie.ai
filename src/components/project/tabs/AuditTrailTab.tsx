'use client';

import { useState } from 'react';
import { Bot, User, Settings, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { useAuditLog } from '@/hooks/useAuditLog';
import { SkeletonList } from '../shared/SkeletonCard';

interface AuditTrailTabProps {
  projectId: string;
}

const ACTION_COLORS: Record<string, string> = {
  created:      'var(--teal)',
  ai_generated: 'var(--teal)',
  reviewed:     'var(--amber)',
  edited:       'var(--amber)',
  approved:     'var(--green-ok)',
  auto_approved:'var(--green-ok)',
  rejected:     'var(--red-flag)',
  exported:     'var(--teal)',
};

function ActorIcon({ actorType }: { actorType: string }) {
  const style = { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
  if (actorType === 'agent') return (
    <div style={{ ...style, background: 'var(--teal-dim)' }}>
      <Bot className="h-3.5 w-3.5" style={{ color: 'var(--teal)' }} />
    </div>
  );
  if (actorType === 'human') return (
    <div style={{ ...style, background: 'var(--surface-2)' }}>
      <User className="h-3.5 w-3.5" style={{ color: 'var(--off-white)' }} />
    </div>
  );
  return (
    <div style={{ ...style, background: 'var(--surface-2)' }}>
      <Settings className="h-3.5 w-3.5" style={{ color: 'rgba(245,244,240,0.4)' }} />
    </div>
  );
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'Just now';
}

export function AuditTrailTab({ projectId }: AuditTrailTabProps) {
  const [showExportsOnly, setShowExportsOnly] = useState(false);
  const { data, isLoading } = useAuditLog(projectId, showExportsOnly ? { actionFilter: 'exported' } : undefined);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const entries = data?.entries ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'rgba(245,244,240,0.5)' }}>
          {data?.count ?? 0} audit entries
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExportsOnly(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: showExportsOnly ? 'var(--teal-dim)' : 'var(--surface-2)',
              color: showExportsOnly ? 'var(--teal)' : 'rgba(245,244,240,0.6)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Exports
          </button>
          <a
            href={`/api/projects/${projectId}/audit?format=csv`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'var(--surface-2)', color: 'rgba(245,244,240,0.6)' }}
            download
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>
        </div>
      </div>

      {isLoading ? (
        <SkeletonList count={6} variant="row" />
      ) : entries.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm" style={{ color: 'rgba(245,244,240,0.3)' }}>No audit entries yet.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div
            className="absolute left-[13px] top-3 bottom-3 w-px"
            style={{ background: 'var(--border)' }}
          />
          <div className="space-y-1">
            {entries.map(entry => {
              const expanded = expandedId === entry.id;
              const actionColor = ACTION_COLORS[entry.action] ?? 'rgba(245,244,240,0.5)';
              return (
                <div key={entry.id} className="flex items-start gap-3 relative">
                  <div className="relative z-10 flex-shrink-0 mt-1">
                    <ActorIcon actorType={entry.actorType} />
                  </div>
                  <div
                    className="flex-1 rounded-xl px-4 py-3 cursor-pointer"
                    style={{ background: 'var(--surface)', border: '1px solid transparent' }}
                    onClick={() => setExpandedId(expanded ? null : entry.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: actionColor }}
                        >
                          {entry.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs truncate" style={{ color: 'rgba(245,244,240,0.5)' }}>
                          {entry.entityType} · {entry.actorId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs" style={{ color: 'rgba(245,244,240,0.3)' }}>
                          {timeAgo(entry.timestamp)}
                        </span>
                        {expanded
                          ? <ChevronUp className="h-3.5 w-3.5" style={{ color: 'rgba(245,244,240,0.3)' }} />
                          : <ChevronDown className="h-3.5 w-3.5" style={{ color: 'rgba(245,244,240,0.3)' }} />
                        }
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-3 space-y-2" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                        {entry.contentHash && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(245,244,240,0.3)' }}>Content Hash</p>
                            <code className="text-[10px] font-mono" style={{ color: 'var(--teal)' }}>
                              {entry.contentHash}
                            </code>
                          </div>
                        )}
                        {entry.diff && Object.keys(entry.diff).length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(245,244,240,0.3)' }}>Diff</p>
                            <pre className="text-[10px] font-mono overflow-auto max-h-32 p-2 rounded" style={{ background: 'var(--navy-800)', color: 'rgba(245,244,240,0.5)' }}>
                              {JSON.stringify(entry.diff, null, 2)}
                            </pre>
                          </div>
                        )}
                        <p className="text-[10px]" style={{ color: 'rgba(245,244,240,0.3)' }}>
                          {new Date(entry.timestamp).toLocaleString()} · Entity: {entry.entityId.slice(0, 8)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
