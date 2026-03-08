'use client';

import { useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle } from 'lucide-react';
import { useDraftGenerationContext } from '@/contexts/DraftGenerationContext';
import { RiskBadge } from '../shared/RiskBadge';

interface DraftGenerationModalProps {
  onViewDraft: () => void;
  onViewReview: () => void;
}

const PIPELINE_STEPS = [
  { key: 'retrieval', label: 'Retrieval', index: 0 },
  { key: 'generation', label: 'Generation', index: 1 },
  { key: 'review', label: 'Review', index: 2 },
] as const;

const STAGE_ORDER: Record<string, number> = {
  retrieval: 0,
  generation: 1,
  writing: 1, // writing is sub-step of generation
  review: 2,
  complete: 3,
  error: 3,
};

function getStageIndex(stage: string): number {
  return STAGE_ORDER[stage] ?? 0;
}

function getStageLabel(stage: string): string {
  const labels: Record<string, string> = {
    retrieval: 'Searching knowledge base...',
    generation: 'Generating draft content...',
    writing: 'Saving draft to database...',
    review: 'Running red-flag analysis...',
  };
  return labels[stage] ?? 'Processing...';
}

function ConfidenceRingSmall({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;
  const color = pct >= 80 ? 'var(--green-ok)' : pct >= 50 ? 'var(--amber)' : 'var(--red-flag)';
  return (
    <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
      <svg viewBox="0 0 48 48" width={48} height={48} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="24" cy="24" r={radius} fill="none" stroke="var(--surface-2)" strokeWidth="4" />
        <circle
          cx="24" cy="24" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <span style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color,
      }}>
        {pct}%
      </span>
    </div>
  );
}

export function DraftGenerationModal({ onViewDraft, onViewReview }: DraftGenerationModalProps) {
  const { generation, cancelGeneration, dismissModal } = useDraftGenerationContext();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll content area as tokens arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [generation?.displayContent]);

  // Invalidate React Query caches when generation completes
  useEffect(() => {
    if (generation?.stage === 'complete' && generation.result) {
      queryClient.invalidateQueries({ queryKey: ['drafts', generation.projectId] });
      queryClient.invalidateQueries({ queryKey: ['requirements', generation.projectId] });
      queryClient.invalidateQueries({ queryKey: ['compliance-score', generation.projectId] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation?.stage, generation?.result?.draftId]);

  const isOpen = generation !== null;

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !generation?.isActive) dismissModal();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed', zIndex: 50,
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%', maxWidth: 680,
            maxHeight: '88vh',
            display: 'flex', flexDirection: 'column',
            borderRadius: 16,
            padding: 24,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
          onEscapeKeyDown={(e) => { if (generation?.isActive) e.preventDefault(); }}
          onPointerDownOutside={(e) => { if (generation?.isActive) e.preventDefault(); }}
        >
          {/* Title */}
          <Dialog.Title style={{ fontSize: 16, fontWeight: 600, color: 'var(--off-white)', marginBottom: 20 }}>
            Generating: <span style={{ color: 'var(--teal)' }}>{generation?.sectionTitle}</span>
          </Dialog.Title>

          {/* Pipeline step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
            {PIPELINE_STEPS.map((step, i) => {
              const currentIdx = getStageIndex(generation?.stage ?? 'retrieval');
              const isDone = currentIdx > step.index || generation?.stage === 'complete';
              const isActive = currentIdx === step.index && generation?.stage !== 'complete' && generation?.stage !== 'error';
              return (
                <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: i < PIPELINE_STEPS.length - 1 ? 1 : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      background: isDone ? 'var(--green-ok)' : isActive ? 'var(--teal)' : 'var(--surface-2)',
                      color: isDone || isActive ? 'var(--navy)' : 'rgba(245,244,240,0.25)',
                      transition: 'background 0.3s, color 0.3s',
                      flexShrink: 0,
                    }}>
                      {isDone ? '✓' : step.index + 1}
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 500,
                      color: isDone || isActive ? 'var(--off-white)' : 'rgba(245,244,240,0.3)',
                      whiteSpace: 'nowrap' as const,
                    }}>
                      {step.label}
                    </span>
                  </div>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <div style={{
                      flex: 1, height: 1, margin: '0 12px',
                      background: isDone ? 'var(--green-ok)' : 'var(--border)',
                      transition: 'background 0.3s',
                    }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Content stream area */}
          {generation?.displayContent ? (
            <div
              ref={scrollRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 16,
                background: 'var(--surface-2)',
                fontSize: 13,
                lineHeight: 1.65,
                color: 'var(--off-white)',
                fontFamily: 'var(--font-mono)',
                minHeight: 180,
                maxHeight: 320,
                whiteSpace: 'pre-wrap' as const,
              }}
            >
              {generation.displayContent}
              {generation.isActive && (
                <span style={{
                  display: 'inline-block',
                  width: 2, height: 14,
                  background: 'var(--teal)',
                  marginLeft: 2,
                  verticalAlign: 'text-bottom',
                  animation: 'pulse 1s infinite',
                }} />
              )}
            </div>
          ) : generation?.isActive ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 12, padding: '40px 0', marginBottom: 16,
            }}>
              <div style={{
                width: 20, height: 20,
                border: '2px solid var(--teal)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ fontSize: 13, color: 'rgba(245,244,240,0.5)' }}>
                {getStageLabel(generation.stage)}
              </span>
            </div>
          ) : null}

          {/* Result summary card */}
          {generation?.stage === 'complete' && generation.result && (
            <div style={{
              borderRadius: 8,
              padding: '14px 16px',
              marginBottom: 16,
              background: 'rgba(0,188,180,0.06)',
              border: '1px solid rgba(0,188,180,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}>
              <ConfidenceRingSmall score={generation.result.confidenceScore} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' as const }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--off-white)' }}>
                    Draft Generated
                  </span>
                  <RiskBadge riskLevel={generation.result.riskLevel} />
                  {generation.result.autoApproved && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                      background: 'rgba(34,197,94,0.12)', color: 'var(--green-ok)',
                      border: '1px solid rgba(34,197,94,0.25)',
                    }}>
                      Auto-Approved
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ fontSize: 12, color: 'rgba(245,244,240,0.5)' }}>
                    {Math.round(generation.result.confidenceScore * 100)}% confidence
                  </span>
                  <span style={{ fontSize: 12, color: 'rgba(245,244,240,0.5)' }}>
                    {generation.result.citationCount} citation{generation.result.citationCount !== 1 ? 's' : ''}
                  </span>
                  {!generation.result.autoApproved && (
                    <span style={{ fontSize: 12, color: 'var(--amber)' }}>Awaiting review</span>
                  )}
                </div>
              </div>
              <CheckCircle size={20} style={{ color: 'var(--green-ok)', flexShrink: 0 }} />
            </div>
          )}

          {/* Error state */}
          {generation?.stage === 'error' && (
            <div style={{
              borderRadius: 8, padding: '12px 16px', marginBottom: 16,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <XCircle size={16} style={{ color: 'var(--red-flag)', flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--red-flag)', marginBottom: 2 }}>
                  Generation failed
                </p>
                <p style={{ fontSize: 12, color: 'rgba(245,244,240,0.5)' }}>
                  {generation.error}
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: 16, borderTop: '1px solid var(--border)',
          }}>
            <div>
              {generation?.isActive && (
                <button
                  onClick={cancelGeneration}
                  style={{
                    fontSize: 13, padding: '6px 14px', borderRadius: 6,
                    background: 'var(--surface-2)',
                    color: 'rgba(245,244,240,0.5)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              {generation?.stage === 'complete' && (
                <>
                  {!generation.result?.autoApproved && (
                    <button
                      onClick={() => { onViewReview(); dismissModal(); }}
                      style={{
                        fontSize: 13, fontWeight: 500, padding: '6px 16px', borderRadius: 6,
                        background: 'var(--surface-2)', color: 'var(--off-white)',
                        border: '1px solid var(--border)', cursor: 'pointer',
                      }}
                    >
                      Go to Review Queue
                    </button>
                  )}
                  <button
                    onClick={() => { onViewDraft(); dismissModal(); }}
                    style={{
                      fontSize: 13, fontWeight: 600, padding: '6px 16px', borderRadius: 6,
                      background: 'var(--teal)', color: 'var(--navy)',
                      border: 'none', cursor: 'pointer',
                    }}
                  >
                    View Draft
                  </button>
                </>
              )}

              {(generation?.stage === 'error' || (!generation?.isActive && generation?.stage !== 'complete')) && (
                <button
                  onClick={dismissModal}
                  style={{
                    fontSize: 13, padding: '6px 16px', borderRadius: 6,
                    background: 'var(--surface-2)', color: 'var(--off-white)',
                    border: '1px solid var(--border)', cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
