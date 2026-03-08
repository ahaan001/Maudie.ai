'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X, Loader2 } from 'lucide-react';
import { useDocumentPreview } from '@/hooks/useDocumentPreview';

const SOURCE_LABELS: Record<string, string> = {
  user_upload: 'Uploaded',
  maude: 'MAUDE',
  standard: 'Standard',
  internal: 'Internal',
  bom: 'BOM',
};

interface DocumentPreviewModalProps {
  projectId: string;
  docId: string;
  chunkId: string;
  onClose: () => void;
}

export function DocumentPreviewModal({ projectId, docId, chunkId, onClose }: DocumentPreviewModalProps) {
  const { data, isLoading } = useDocumentPreview(projectId, docId, chunkId);

  const doc = data?.document;
  const page = data?.chunks.find(c => c.isCited)?.metadata?.page_number;

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: 'rgba(0,0,0,0.5)',
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed', zIndex: 60,
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'calc(100% - 48px)', maxWidth: 680,
            maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
            borderRadius: 12,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Dialog.Title style={{ fontSize: 14, fontWeight: 700, color: 'var(--off-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc?.name ?? 'Loading…'}
              </Dialog.Title>
              <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                {doc?.sourceType && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'var(--teal-dim)', color: 'var(--teal)' }}>
                    {SOURCE_LABELS[doc.sourceType] ?? doc.sourceType}
                  </span>
                )}
                {page != null && (
                  <span style={{ fontSize: 10, color: 'rgba(245,244,240,0.4)' }}>Page {page}</span>
                )}
              </div>
            </div>
            <Dialog.Close asChild>
              <button style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(245,244,240,0.4)', flexShrink: 0, marginLeft: 12 }}>
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>
            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                <Loader2 size={20} style={{ color: 'var(--teal)', animation: 'spin 1s linear infinite' }} />
              </div>
            )}

            {!isLoading && !data && (
              <p style={{ fontSize: 13, color: 'rgba(245,244,240,0.35)', textAlign: 'center', padding: '40px 0' }}>
                No preview available
              </p>
            )}

            {data?.chunks.map(chunk => (
              <div
                key={chunk.id}
                style={{
                  padding: '12px 16px', borderRadius: 8, marginBottom: 12,
                  background: chunk.isCited ? 'rgba(0,188,180,0.06)' : 'var(--surface-2)',
                  borderLeft: chunk.isCited ? '3px solid var(--teal)' : '3px solid transparent',
                }}
              >
                {chunk.isCited && (
                  <p style={{ fontSize: 9, color: 'var(--teal)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                    Cited Passage
                  </p>
                )}
                <p style={{
                  fontSize: 12, lineHeight: 1.65, whiteSpace: 'pre-wrap',
                  color: chunk.isCited ? 'var(--off-white)' : 'rgba(245,244,240,0.5)',
                }}>
                  {chunk.content}
                </p>
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
