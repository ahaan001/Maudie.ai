'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { useDraftContent } from '@/hooks/useDraftContent';
import type { EnrichedCitation } from '@/hooks/useDraftContent';
import { formatSectionLabel } from '../overview/SectionsChecklist';
import { DocumentPreviewModal } from './DocumentPreviewModal';

const SOURCE_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  user_upload: { label: 'Uploaded', color: 'var(--off-white)', bg: 'var(--surface-2)' },
  maude: { label: 'MAUDE', color: 'var(--red-flag)', bg: 'rgba(224,82,82,0.12)' },
  standard: { label: 'Standard', color: 'var(--teal)', bg: 'var(--teal-dim)' },
  internal: { label: 'Internal', color: 'var(--amber)', bg: 'rgba(245,166,35,0.12)' },
  bom: { label: 'BOM', color: 'rgba(245,244,240,0.5)', bg: 'var(--surface-2)' },
};

function SourceBadge({ sourceType }: { sourceType: string | null }) {
  const badge = SOURCE_BADGES[sourceType ?? ''] ?? { label: sourceType ?? 'Unknown', color: 'rgba(245,244,240,0.5)', bg: 'var(--surface-2)' };
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: badge.bg, color: badge.color }}>
      {badge.label}
    </span>
  );
}

interface CitationMarkerProps {
  number: number;
  citation: EnrichedCitation;
  isOpen: boolean;
  onToggle: () => void;
}

function CitationMarker({ number, citation, isOpen, onToggle }: CitationMarkerProps) {
  const text = citation.chunkContent ?? citation.textExcerpt ?? '';
  const preview = text.length > 350 ? text.slice(0, 350) + '…' : text;
  const simPct = citation.similarityScore != null ? Math.round(citation.similarityScore * 100) : null;
  const page = citation.pageNumber ?? citation.chunkMetadata?.page_number;

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        style={{
          fontSize: 10, fontWeight: 700, color: 'var(--teal)',
          background: 'var(--teal-dim)', border: '1px solid rgba(0,188,180,0.3)',
          borderRadius: 3, padding: '1px 5px', cursor: 'pointer', lineHeight: 1.4,
        }}
      >
        [{number}]
      </button>
      {isOpen && (
        <div
          style={{
            position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 20,
            width: 320, padding: 12, borderRadius: 8,
            background: 'var(--surface)', border: '1px solid var(--border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {preview && (
            <p style={{ fontSize: 11, color: 'rgba(245,244,240,0.7)', lineHeight: 1.55, marginBottom: 8, whiteSpace: 'pre-wrap' }}>
              {preview}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {citation.documentName && (
              <span style={{ fontSize: 11, color: 'var(--off-white)', fontWeight: 600, flex: 1 }}>
                {citation.documentName}
              </span>
            )}
            <SourceBadge sourceType={citation.sourceType} />
            {simPct != null && (
              <span style={{ fontSize: 10, color: 'rgba(245,244,240,0.4)' }}>{simPct}% match</span>
            )}
            {page != null && (
              <span style={{ fontSize: 10, color: 'rgba(245,244,240,0.4)' }}>p.{page}</span>
            )}
          </div>
        </div>
      )}
    </span>
  );
}

interface DraftViewerModalProps {
  draftId: string | null;
  projectId: string;
  onClose: () => void;
}

export function DraftViewerModal({ draftId, projectId, onClose }: DraftViewerModalProps) {
  const { data, isLoading } = useDraftContent(draftId);
  const [sourcePanelOpen, setSourcePanelOpen] = useState(true);
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const [docPreview, setDocPreview] = useState<{ docId: string; chunkId: string } | null>(null);
  const auditPostedRef = useRef(false);

  // Reset audit flag when a new draft opens
  useEffect(() => {
    auditPostedRef.current = false;
  }, [draftId]);

  // Fire audit event once when citations data first loads
  useEffect(() => {
    if (!data || auditPostedRef.current || !draftId) return;
    auditPostedRef.current = true;
    const sourceCount = new Set(data.citations.map(c => c.documentId)).size;
    fetch(`/api/projects/${projectId}/drafts/${draftId}/evidence-reviewed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceCount }),
    }).catch(console.error);
  }, [data, draftId, projectId]);

  // Close popover on outside click
  useEffect(() => {
    if (!activePopover) return;
    const handler = () => setActivePopover(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [activePopover]);

  const citationNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    data?.citations.forEach((c, i) => map.set(c.id, i + 1));
    return map;
  }, [data?.citations]);

  const citationsBySectionId = useMemo(() => {
    const map = new Map<string, EnrichedCitation[]>();
    data?.citations.forEach(c => {
      const arr = map.get(c.sectionId) ?? [];
      arr.push(c);
      map.set(c.sectionId, arr);
    });
    return map;
  }, [data?.citations]);

  const citationsByDocId = useMemo(() => {
    const map = new Map<string, { docName: string; sourceType: string | null; citations: EnrichedCitation[] }>();
    data?.citations.forEach(c => {
      const entry = map.get(c.documentId) ?? { docName: c.documentName ?? 'Unknown', sourceType: c.sourceType, citations: [] };
      entry.citations.push(c);
      map.set(c.documentId, entry);
    });
    return map;
  }, [data?.citations]);

  return (
    <>
      <Dialog.Root open={!!draftId} onOpenChange={(open) => { if (!open) onClose(); }}>
        <Dialog.Portal>
          <Dialog.Overlay
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            }}
          />
          <Dialog.Content
            style={{
              position: 'fixed', zIndex: 50,
              left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'calc(100% - 48px)', maxWidth: 960,
              maxHeight: '90vh',
              display: 'flex', flexDirection: 'column',
              borderRadius: 16,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              overflow: 'hidden',
            }}
            onClick={() => setActivePopover(null)}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
            }}>
              <div>
                <Dialog.Title style={{ fontSize: 15, fontWeight: 700, color: 'var(--off-white)', marginBottom: 2 }}>
                  {data?.draft.title ?? formatSectionLabel(data?.draft.sectionType ?? '')}
                </Dialog.Title>
                {data && (
                  <p style={{ fontSize: 11, color: 'rgba(245,244,240,0.4)' }}>
                    {data.citations.length} citation{data.citations.length !== 1 ? 's' : ''} from {new Set(data.citations.map(c => c.documentId)).size} source{new Set(data.citations.map(c => c.documentId)).size !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {data && data.citations.length > 0 && (
                  <button
                    onClick={() => setSourcePanelOpen(p => !p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 12, fontWeight: 600, padding: '5px 10px',
                      background: sourcePanelOpen ? 'var(--teal-dim)' : 'var(--surface-2)',
                      color: sourcePanelOpen ? 'var(--teal)' : 'rgba(245,244,240,0.5)',
                      border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer',
                    }}
                  >
                    {sourcePanelOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
                    Sources
                  </button>
                )}
                <Dialog.Close asChild>
                  <button style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(245,244,240,0.4)' }}>
                    <X size={16} />
                  </button>
                </Dialog.Close>
              </div>
            </div>

            {/* Body */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Content column */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minWidth: 0 }}>
                {isLoading && (
                  <p style={{ fontSize: 13, color: 'rgba(245,244,240,0.4)' }}>Loading draft…</p>
                )}
                {data?.sections.map(section => {
                  const sectionCitations = citationsBySectionId.get(section.id) ?? [];
                  return (
                    <div key={section.id} style={{ marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
                      <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
                        {formatSectionLabel(section.sectionType)}
                      </h3>
                      <p style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--off-white)', whiteSpace: 'pre-wrap' }}>
                        {section.content}
                      </p>
                      {sectionCitations.length > 0 && (
                        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'rgba(245,244,240,0.3)', marginRight: 2 }}>Sources:</span>
                          {sectionCitations.map(c => (
                            <CitationMarker
                              key={c.id}
                              number={citationNumberMap.get(c.id) ?? 0}
                              citation={c}
                              isOpen={activePopover === c.id}
                              onToggle={() => setActivePopover(prev => prev === c.id ? null : c.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {data && data.citations.length === 0 && !isLoading && (
                  <p style={{ fontSize: 12, color: 'rgba(245,244,240,0.35)', fontStyle: 'italic', marginTop: 8 }}>
                    No source citations found for this draft.
                  </p>
                )}
              </div>

              {/* Sources panel */}
              <div style={{
                width: sourcePanelOpen && data && data.citations.length > 0 ? 280 : 0,
                flexShrink: 0, overflow: 'hidden',
                transition: 'width 0.2s ease',
                borderLeft: '1px solid var(--border)',
              }}>
                <div style={{ width: 280, padding: 16, overflowY: 'auto', height: '100%' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(245,244,240,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                    Sources
                  </p>
                  {Array.from(citationsByDocId.entries()).map(([docId, entry]) => (
                    <button
                      key={docId}
                      onClick={() => setDocPreview({ docId, chunkId: entry.citations[0].chunkId })}
                      style={{
                        width: '100%', textAlign: 'left', marginBottom: 8,
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        display: 'flex', flexDirection: 'column', gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--off-white)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.docName}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--teal)', flexShrink: 0 }}>
                          {entry.citations.length}
                        </span>
                      </div>
                      <SourceBadge sourceType={entry.sourceType} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Nested document preview */}
      {docPreview && (
        <DocumentPreviewModal
          projectId={projectId}
          docId={docPreview.docId}
          chunkId={docPreview.chunkId}
          onClose={() => setDocPreview(null)}
        />
      )}
    </>
  );
}
