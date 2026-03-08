'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { hasRole } from '@/lib/auth/permissions';
import type { OrgRole } from '@/lib/db/schema';
import { RiskMatrix } from '../risk/RiskMatrix';
import { RiskSummaryCard } from '../risk/RiskSummaryCard';
import { HazardTable } from '../risk/HazardTable';
import { HazardDetailPanel } from '../risk/HazardDetailPanel';
import { AddHazardModal } from '../risk/AddHazardModal';
import type { RiskControl } from '@/lib/db/schema';

interface HazardWithControls {
  id: string;
  number: number;
  description: string;
  harm?: string | null;
  hazardousSituation?: string | null;
  hazardCategory?: string | null;
  initialSeverity?: number | null;
  initialProbability?: number | null;
  initialRpr: number | null;
  mitigationMeasures?: string[] | null;
  residualSeverity?: number | null;
  residualProbability?: number | null;
  residualRpr: number | null;
  riskStatus: string;
  acceptability?: string | null;
  controls: RiskControl[];
}

interface RiskResponse {
  hazards: HazardWithControls[];
  summary: {
    total: number;
    open: number;
    mitigated: number;
    accepted: number;
    transferred: number;
    unacceptable: number;
    highestUnmitigatedRpr: number;
  };
}

interface RiskTabProps {
  projectId: string;
}

export function RiskTab({ projectId }: RiskTabProps) {
  const { data: sessionData } = useSession();
  const queryClient = useQueryClient();
  const [selectedHazardId, setSelectedHazardId] = useState<string | null>(null);
  const [editHazard, setEditHazard] = useState<HazardWithControls | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const canWrite = hasRole((sessionData?.user?.orgRole as OrgRole | null | undefined), 'engineer');

  const { data, isLoading } = useQuery<RiskResponse>({
    queryKey: ['risk', projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/risk`).then(r => r.json()),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['risk', projectId] });
  }

  async function deleteHazard(id: string) {
    await fetch(`/api/projects/${projectId}/risk/hazards/${id}`, { method: 'DELETE' });
    if (selectedHazardId === id) setSelectedHazardId(null);
    invalidate();
  }

  const hazards = data?.hazards ?? [];
  const summary = data?.summary ?? { total: 0, open: 0, mitigated: 0, accepted: 0, transferred: 0, unacceptable: 0, highestUnmitigatedRpr: 0 };

  const selectedHazard = hazards.find(h => h.id === selectedHazardId) ?? null;

  // Data for matrices
  const initialPoints = hazards.map(h => ({ id: h.id, number: h.number, description: h.description, severity: h.initialSeverity ?? null, probability: h.initialProbability ?? null }));
  const residualPoints = hazards.map(h => ({ id: h.id, number: h.number, description: h.description, severity: h.residualSeverity ?? null, probability: h.residualProbability ?? null }));

  return (
    <div style={{ position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--off-white)', marginBottom: 2 }}>Risk Management File</h2>
          <p style={{ fontSize: 12, color: 'rgba(245,244,240,0.4)' }}>ISO 14971:2019 compliant risk analysis</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href={`/api/projects/${projectId}/risk/export`}
            target="_blank" rel="noreferrer"
            style={{
              fontSize: 13, fontWeight: 600, padding: '7px 16px',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--off-white)', textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            ↓ Export PDF
          </a>
          {canWrite && (
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                fontSize: 13, fontWeight: 600, padding: '7px 16px',
                background: 'var(--teal)', color: 'var(--navy)',
                border: 'none', borderRadius: 6, cursor: 'pointer',
              }}
            >
              + Add Hazard
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <p style={{ fontSize: 13, color: 'rgba(245,244,240,0.4)' }}>Loading risk data…</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <RiskSummaryCard summary={summary} />

          {/* Risk Matrices */}
          {hazards.length > 0 && (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(245,244,240,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>
                Risk Matrix
              </p>
              <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                <RiskMatrix hazards={initialPoints} label="Initial Risk" onHazardClick={setSelectedHazardId} />
                <RiskMatrix hazards={residualPoints} label="Residual Risk (after controls)" onHazardClick={setSelectedHazardId} />
              </div>
            </div>
          )}

          {/* Empty state */}
          {hazards.length === 0 && (
            <div style={{
              border: '2px dashed var(--border)', borderRadius: 8,
              padding: '48px 24px', textAlign: 'center', marginBottom: 24,
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(245,244,240,0.6)', marginBottom: 8 }}>
                No hazards identified yet
              </p>
              <p style={{ fontSize: 12, color: 'rgba(245,244,240,0.35)', marginBottom: 16 }}>
                Run intelligence analysis to auto-generate hazards from MAUDE data, or add them manually.
              </p>
              {canWrite && (
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{ fontSize: 13, fontWeight: 600, padding: '8px 20px', background: 'var(--teal)', color: 'var(--navy)', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                >
                  + Add First Hazard
                </button>
              )}
            </div>
          )}

          {/* Hazard Table */}
          {hazards.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(245,244,240,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
                Hazard Registry ({hazards.length})
              </p>
              <HazardTable
                hazards={hazards}
                projectId={projectId}
                onHazardClick={setSelectedHazardId}
                onEditHazard={h => setEditHazard(h)}
                onDeleteHazard={deleteHazard}
                onControlAdded={invalidate}
              />
            </div>
          )}
        </>
      )}

      {/* Detail Panel */}
      {selectedHazard && (
        <HazardDetailPanel
          hazard={selectedHazard}
          projectId={projectId}
          onClose={() => setSelectedHazardId(null)}
          onUpdated={invalidate}
        />
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddHazardModal
          projectId={projectId}
          onClose={() => setShowAddModal(false)}
          onSaved={invalidate}
        />
      )}

      {/* Edit Modal */}
      {editHazard && (
        <AddHazardModal
          projectId={projectId}
          hazard={editHazard}
          onClose={() => setEditHazard(null)}
          onSaved={invalidate}
        />
      )}
    </div>
  );
}
