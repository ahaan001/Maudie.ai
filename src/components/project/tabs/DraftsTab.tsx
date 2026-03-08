'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Sparkles, Eye, RefreshCw, FileText } from 'lucide-react';
import { useDrafts } from '@/hooks/useDrafts';
import { useRequirements } from '@/hooks/useRequirements';
import { useDraftGenerationContext } from '@/contexts/DraftGenerationContext';
import { hasRole } from '@/lib/auth/permissions';
import type { OrgRole } from '@/lib/db/schema';
import { StatusBadge } from '../shared/StatusBadge';
import { formatSectionLabel } from '../overview/SectionsChecklist';
import { RequirementsSidebar } from '../drafts/RequirementsSidebar';
import { DraftViewerModal } from '../drafts/DraftViewerModal';
import { TraceabilityMatrix } from '../drafts/TraceabilityMatrix';
import type { RegulatoryProfile } from '@/types/regulatory';

interface DraftsTabProps {
  projectId: string;
  regulatoryProfile: RegulatoryProfile;
}

function ConfidenceRing({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.round(score * 100);
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;
  const color = pct >= 80 ? 'var(--green-ok)' : pct >= 50 ? 'var(--amber)' : 'var(--red-flag)';

  return (
    <div className="relative w-10 h-10 flex-shrink-0">
      <svg viewBox="0 0 40 40" className="w-10 h-10 -rotate-90">
        <circle cx="20" cy="20" r={radius} fill="none" stroke="var(--surface-2)" strokeWidth="3" />
        <circle
          cx="20" cy="20" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
        style={{ color }}
      >
        {pct}%
      </span>
    </div>
  );
}

export function DraftsTab({ projectId, regulatoryProfile }: DraftsTabProps) {
  const queryClient = useQueryClient();
  const { data: sessionData } = useSession();
  const { data, isLoading } = useDrafts(projectId);
  const { data: reqData } = useRequirements(projectId);
  const { generation, startGeneration } = useDraftGenerationContext();
  const canGenerate = hasRole((sessionData?.user?.orgRole as OrgRole | null | undefined), 'engineer');
  const [generatingAll, setGeneratingAll] = useState(false);
  const [viewMode, setViewMode] = useState<'drafts' | 'matrix'>('drafts');
  const [viewingDraftId, setViewingDraftId] = useState<string | null>(null);

  const drafts = data?.drafts ?? [];

  // Single-section generation goes through the SSE streaming path (opens modal)
  function generateDraft(sectionType: string) {
    startGeneration(projectId, sectionType, formatSectionLabel(sectionType));
  }

  // "Generate All" uses the fire-and-forget pg-boss queue (batch, no modal)
  async function generateAll() {
    setGeneratingAll(true);
    const missing = regulatoryProfile.required_sections.filter(
      s => !drafts.some(d => d.sectionType === s && d.status !== 'rejected')
    );
    for (const section of missing) {
      await fetch(`/api/projects/${projectId}/agents/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'documentation_drafting', params: { sectionType: section } }),
      });
    }
    queryClient.invalidateQueries({ queryKey: ['drafts', projectId] });
    queryClient.invalidateQueries({ queryKey: ['requirements', projectId] });
    setGeneratingAll(false);
  }

  const missingSections = regulatoryProfile.required_sections.filter(
    s => !drafts.some(d => d.sectionType === s && d.status !== 'rejected')
  );

  // Track which section is actively streaming for button/sidebar state
  const activeStreamingSection = generation?.isActive ? generation.sectionKey : null;
  const sidebarGeneratingKey = activeStreamingSection;

  return (
    <>
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
    <div className="space-y-6" style={{ flex: 1, minWidth: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 8, padding: 3, flexShrink: 0 }}>
          {(['drafts', 'matrix'] as const).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{
              fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: viewMode === mode ? 'var(--teal)' : 'transparent',
              color: viewMode === mode ? 'var(--navy)' : 'rgba(245,244,240,0.5)',
            }}>
              {mode === 'drafts' ? 'Drafts' : 'Traceability'}
            </button>
          ))}
        </div>
        <p className="text-sm flex-1" style={{ color: 'rgba(245,244,240,0.5)' }}>
          {drafts.length} of {regulatoryProfile.required_sections.length} sections generated
        </p>
        {missingSections.length > 0 && canGenerate && viewMode === 'drafts' && (
          <button
            onClick={generateAll}
            disabled={generatingAll}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-opacity hover:opacity-80"
            style={{ background: 'var(--teal)', color: 'var(--navy)' }}
          >
            {generatingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate All Drafts
          </button>
        )}
      </div>

      {/* Traceability Matrix view */}
      {viewMode === 'matrix' && (
        <TraceabilityMatrix projectId={projectId} regulatoryProfile={regulatoryProfile} />
      )}

      {/* Section Cards Grid */}
      {viewMode === 'drafts' && (isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {regulatoryProfile.required_sections.map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl h-40" style={{ background: 'var(--surface-2)' }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {regulatoryProfile.required_sections.map(section => {
            const draft = drafts.find(d => d.sectionType === section && d.status !== 'rejected');
            const isGen = activeStreamingSection === section;

            if (!draft) {
              // Missing section card
              return (
                <div
                  key={section}
                  className="rounded-xl p-4 flex flex-col gap-3"
                  style={{ border: '2px dashed var(--border)', background: 'var(--surface)' }}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" style={{ color: 'rgba(245,244,240,0.2)' }} />
                    <p className="text-sm font-medium" style={{ color: 'rgba(245,244,240,0.4)' }}>
                      {formatSectionLabel(section)}
                    </p>
                  </div>
                  <p className="text-xs flex-1" style={{ color: 'rgba(245,244,240,0.25)' }}>Not yet generated</p>
                  {canGenerate && (
                    <button
                      onClick={() => generateDraft(section)}
                      disabled={isGen}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 self-start"
                      style={{ background: 'var(--teal-dim)', color: 'var(--teal)' }}
                    >
                      {isGen ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      Generate
                    </button>
                  )}
                </div>
              );
            }

            // Has a draft
            const borderColor = draft.status === 'approved' ? 'var(--green-ok)' : 'var(--amber)';
            const section0 = (draft as unknown as { sections?: Array<{ confidenceScore: number | null; version: number; aiGenerated: boolean }> }).sections?.[0];
            const confidence = section0?.confidenceScore ?? null;
            const version = section0?.version ?? 1;
            const aiGenerated = section0?.aiGenerated ?? true;

            return (
              <div
                key={section}
                className="glass-card rounded-xl p-4 flex flex-col gap-3"
                style={{ borderLeft: `3px solid ${borderColor}` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold" style={{ color: 'var(--off-white)' }}>
                    {formatSectionLabel(section)}
                  </p>
                  <ConfidenceRing score={confidence} />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={draft.status} size="xs" />
                  {aiGenerated && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--teal-dim)', color: 'var(--teal)' }}>
                      AI
                    </span>
                  )}
                  <span className="text-[10px]" style={{ color: 'rgba(245,244,240,0.3)' }}>v{version}</span>
                </div>

                <div className="flex gap-2 mt-auto pt-1">
                  <button
                    onClick={() => setViewingDraftId(draft.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium"
                    style={{ background: 'var(--surface-2)', color: 'var(--off-white)', border: 'none', cursor: 'pointer' }}
                  >
                    <Eye className="h-3 w-3" /> View
                  </button>
                  {canGenerate && (
                    <button
                      onClick={() => generateDraft(section)}
                      disabled={isGen}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium disabled:opacity-50"
                      style={{ background: 'var(--surface-2)', color: 'rgba(245,244,240,0.5)' }}
                    >
                      {isGen ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Regenerate
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {!isLoading && viewMode === 'drafts' && drafts.length > 0 && (
        <p className="text-xs" style={{ color: 'rgba(245,244,240,0.3)' }}>
          Draft generation uses Ollama (Mistral 7B) and may take 1–2 minutes on CPU.
        </p>
      )}
    </div>
      {reqData && viewMode === 'drafts' && (
        <RequirementsSidebar
          requirements={reqData.requirements}
          onGenerate={generateDraft}
          generatingKey={sidebarGeneratingKey}
        />
      )}
    </div>

    <DraftViewerModal
      draftId={viewingDraftId}
      projectId={projectId}
      onClose={() => setViewingDraftId(null)}
    />
    </>
  );
}
