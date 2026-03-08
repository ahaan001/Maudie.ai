'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Play, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useIntelligence } from '@/hooks/useIntelligence';
import { SkeletonList } from '../shared/SkeletonCard';
import type { ProjectSummary } from '@/hooks/useProjectSummary';

interface IntelligenceTabProps {
  projectId: string;
  lastIntelligenceRun: ProjectSummary['lastIntelligenceRun'];
}

function severityBadge(eventCount: number) {
  if (eventCount >= 50) return { label: 'High', color: 'var(--red-flag)', bg: 'var(--red-dim)' };
  if (eventCount >= 20) return { label: 'Medium', color: 'var(--amber)', bg: 'var(--amber-dim)' };
  return { label: 'Low', color: 'var(--green-ok)', bg: 'var(--green-dim)' };
}

export function IntelligenceTab({ projectId, lastIntelligenceRun }: IntelligenceTabProps) {
  const queryClient = useQueryClient();
  const isRunning = lastIntelligenceRun?.status === 'running';
  const { data, isLoading } = useIntelligence(projectId, isRunning);
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState('');

  const clusters = data?.clusters ?? [];
  const hazards = data?.hazards ?? [];

  async function runAnalysis() {
    setTriggering(true);
    setTriggerError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/agents/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'regulatory_intelligence', params: {} }),
      });
      if (!res.ok) throw new Error(await res.text());
      queryClient.invalidateQueries({ queryKey: ['project-summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['intelligence', projectId] });
    } catch (e) {
      setTriggerError(e instanceof Error ? e.message : 'Failed to start analysis');
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Polling banner */}
      {isRunning && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg"
          style={{ background: 'var(--teal-dim)', border: '1px solid rgba(0,212,180,0.2)' }}
        >
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--teal)' }} />
          <p className="text-sm" style={{ color: 'var(--teal)' }}>
            Intelligence analysis running — refreshing every 5 seconds...
          </p>
        </div>
      )}

      {/* CTA if no clusters */}
      {!isLoading && clusters.length === 0 && !isRunning && (
        <div className="text-center py-12">
          <ShieldAlert className="h-10 w-10 mx-auto mb-4" style={{ color: 'rgba(245,244,240,0.2)' }} />
          <p className="text-sm mb-1" style={{ color: 'rgba(245,244,240,0.5)' }}>No failure clusters yet.</p>
          <p className="text-xs mb-6" style={{ color: 'rgba(245,244,240,0.3)' }}>
            Run the intelligence analysis to identify failure patterns from MAUDE data.
          </p>
          <button
            onClick={runAnalysis}
            disabled={triggering}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-opacity hover:opacity-80"
            style={{ background: 'var(--teal)', color: 'var(--navy)' }}
          >
            {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run Intelligence Analysis
          </button>
          {triggerError && <p className="mt-3 text-xs" style={{ color: 'var(--red-flag)' }}>{triggerError}</p>}
        </div>
      )}

      {/* Re-run button if clusters exist */}
      {!isLoading && clusters.length > 0 && !isRunning && (
        <div className="flex justify-between items-center">
          <p className="text-sm" style={{ color: 'rgba(245,244,240,0.5)' }}>
            {clusters.length} failure cluster{clusters.length !== 1 ? 's' : ''} found
          </p>
          <button
            onClick={runAnalysis}
            disabled={triggering}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
            style={{ background: 'var(--surface-2)', color: 'var(--teal)' }}
          >
            {triggering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Re-run Analysis
          </button>
        </div>
      )}

      {/* Cluster masonry grid */}
      {isLoading ? (
        <SkeletonList count={4} variant="card" />
      ) : clusters.length > 0 ? (
        <div style={{ columns: '2', gap: '1rem', columnFill: 'balance' }} className="lg:columns-2 columns-1">
          {clusters.map(cluster => {
            const severity = severityBadge(cluster.eventCount);
            const linkedHazards = hazards.filter(h => h.description.toLowerCase().includes(cluster.failureMode.toLowerCase()));
            return (
              <div
                key={cluster.id}
                className="glass-card rounded-xl p-4 mb-4"
                style={{ breakInside: 'avoid' }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold" style={{ color: 'var(--off-white)' }}>
                    {cluster.clusterName}
                  </p>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded flex-shrink-0"
                    style={{ color: severity.color, background: severity.bg }}
                  >
                    {severity.label}
                  </span>
                </div>
                {cluster.description && (
                  <p className="text-xs mb-3 leading-relaxed" style={{ color: 'rgba(245,244,240,0.55)' }}>
                    {cluster.description}
                  </p>
                )}
                <div className="flex items-center gap-4 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3" style={{ color: 'var(--amber)' }} />
                    <span className="text-xs" style={{ color: 'rgba(245,244,240,0.5)' }}>
                      {cluster.eventCount} events
                    </span>
                  </div>
                  {linkedHazards.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="h-3 w-3" style={{ color: 'var(--red-flag)' }} />
                      <span className="text-xs" style={{ color: 'rgba(245,244,240,0.5)' }}>
                        {linkedHazards.length} hazard{linkedHazards.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
