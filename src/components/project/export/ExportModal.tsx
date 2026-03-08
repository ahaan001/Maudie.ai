'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import { X, FileText, FolderArchive, AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react';

interface PreflightSection {
  sectionKey: string;
  title: string;
  status: string;
  required: boolean;
}

interface PreflightData {
  ok: boolean;
  score: number;
  sections: PreflightSection[];
  blockers: string[];
}

type ExportFormat = 'pdf' | 'zip' | 'ectd';
type ExportState = 'idle' | 'exporting' | 'complete' | 'error';

interface SSECompleteEvent { type: 'complete'; token: string; filename: string; hash: string }
interface SSEStageEvent { type: 'stage'; stage: string; message: string }
interface SSEErrorEvent { type: 'error'; message: string }
type SSEEvent = SSECompleteEvent | SSEStageEvent | SSEErrorEvent;

const STAGES = [
  { key: 'compiling', label: 'Compiling Sections' },
  { key: 'generating', label: 'Generating File' },
  { key: 'finalizing', label: 'Finalizing' },
];

const FORMAT_OPTIONS: { value: ExportFormat; label: string; desc: string; icon: React.FC<{ className?: string }> }[] = [
  { value: 'pdf', label: 'PDF', desc: 'Single compiled document', icon: FileText },
  { value: 'zip', label: 'ZIP', desc: 'Folder of .docx files', icon: FolderArchive },
  { value: 'ectd', label: 'eCTD', desc: 'FDA eCTD module structure', icon: FolderArchive },
];

interface ExportModalProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export function ExportModal({ projectId, open, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: preflight, isLoading: preflightLoading } = useQuery<PreflightData>({
    queryKey: ['export-preflight', projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/export`).then(r => r.json()),
    enabled: open,
    staleTime: 60_000,
  });

  function handleClose() {
    if (exportState === 'exporting') return; // block close during export
    setExportState('idle');
    setCurrentStage(null);
    setError(null);
    onClose();
  }

  async function handleExport() {
    setExportState('exporting');
    setCurrentStage('compiling');
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      });

      if (res.status === 422) {
        const body = await res.json();
        setError(body.blockers?.join('; ') ?? 'Export blocked');
        setExportState('error');
        return;
      }

      if (!res.ok || !res.body) {
        setError('Export request failed');
        setExportState('error');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as SSEEvent;
            if (event.type === 'stage') {
              setCurrentStage(event.stage);
            } else if (event.type === 'complete') {
              setExportState('complete');
              triggerDownload(`/api/projects/${projectId}/export/download?token=${event.token}`, event.filename);
            } else if (event.type === 'error') {
              setError(event.message);
              setExportState('error');
            }
          } catch { /* malformed event */ }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      setExportState('error');
    }
  }

  function triggerDownload(url: string, filename: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const approvedCount = preflight?.sections.filter(s => s.status === 'approved').length ?? 0;
  const totalCount = preflight?.sections.length ?? 0;
  const isBlocked = (preflight?.blockers.length ?? 0) > 0;

  return (
    <Dialog.Root open={open} onOpenChange={open => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 50, backdropFilter: 'blur(2px)',
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 560, maxWidth: '95vw', maxHeight: '90vh',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 16, padding: 28, zIndex: 51,
            overflowY: 'auto',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <Dialog.Title style={{ fontSize: 16, fontWeight: 600, color: 'var(--off-white)', margin: 0 }}>
                Export Submission Package
              </Dialog.Title>
              <Dialog.Description style={{ fontSize: 12, color: 'rgba(245,244,240,0.45)', marginTop: 2 }}>
                Compile approved documentation into an FDA-ready package
              </Dialog.Description>
            </div>
            <button onClick={handleClose} disabled={exportState === 'exporting'} style={{ color: 'rgba(245,244,240,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {exportState === 'idle' || exportState === 'error' ? (
            <>
              {/* Format Selector */}
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(245,244,240,0.4)' }}>Format</p>
                <div className="flex gap-2">
                  {FORMAT_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const active = format === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setFormat(opt.value)}
                        className="flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-medium transition-colors"
                        style={{
                          background: active ? 'var(--teal-dim)' : 'var(--surface-2)',
                          border: `1px solid ${active ? 'var(--teal)' : 'var(--border)'}`,
                          color: active ? 'var(--teal)' : 'rgba(245,244,240,0.6)',
                          cursor: 'pointer',
                        }}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="font-semibold">{opt.label}</span>
                        <span style={{ fontSize: 10, opacity: 0.7 }}>{opt.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Blockers */}
              {isBlocked && preflight && (
                <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(185,28,28,0.12)', border: '1px solid rgba(185,28,28,0.3)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5" style={{ color: 'var(--red-flag)', flexShrink: 0 }} />
                    <p className="text-xs font-semibold" style={{ color: 'var(--red-flag)' }}>Export Blocked</p>
                  </div>
                  {preflight.blockers.map((b, i) => (
                    <p key={i} className="text-xs ml-5" style={{ color: 'rgba(245,244,240,0.65)' }}>• {b}</p>
                  ))}
                </div>
              )}

              {/* Error from previous attempt */}
              {exportState === 'error' && error && (
                <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(185,28,28,0.12)', border: '1px solid rgba(185,28,28,0.3)' }}>
                  <p className="text-xs" style={{ color: 'var(--red-flag)' }}>Export failed: {error}</p>
                </div>
              )}

              {/* Section Checklist */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(245,244,240,0.4)' }}>Required Sections</p>
                  {!preflightLoading && (
                    <p className="text-xs" style={{ color: approvedCount === totalCount ? 'var(--green-ok)' : 'rgba(245,244,240,0.4)' }}>
                      {approvedCount} / {totalCount} approved
                    </p>
                  )}
                </div>
                {preflightLoading ? (
                  <div className="space-y-2">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="h-7 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {(preflight?.sections ?? []).map(s => (
                      <div key={s.sectionKey} className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                        <span className="text-xs" style={{ color: 'rgba(245,244,240,0.7)' }}>{s.title}</span>
                        {s.status === 'approved' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--green-ok)' }} />
                        ) : s.status === 'in_progress' ? (
                          <Clock className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--amber)' }} />
                        ) : (
                          <div className="h-3.5 w-3.5 rounded-full border flex-shrink-0" style={{ borderColor: 'rgba(245,244,240,0.2)' }} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Export CTA */}
              <button
                onClick={handleExport}
                disabled={isBlocked || preflightLoading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: isBlocked || preflightLoading ? 'var(--surface-2)' : 'var(--teal)',
                  color: isBlocked || preflightLoading ? 'rgba(245,244,240,0.3)' : '#0d1b3e',
                  border: 'none',
                  cursor: isBlocked || preflightLoading ? 'not-allowed' : 'pointer',
                }}
              >
                Export Package
              </button>
            </>
          ) : exportState === 'exporting' ? (
            /* Progress View */
            <div className="py-4">
              <div className="flex items-center justify-center mb-8">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--teal)' }} />
              </div>
              <div className="flex items-center gap-2 mb-6">
                {STAGES.map((stage, i) => {
                  const stageIdx = STAGES.findIndex(s => s.key === currentStage);
                  const isDone = i < stageIdx;
                  const isActive = stage.key === currentStage;
                  return (
                    <div key={stage.key} className="flex items-center flex-1">
                      <div
                        className="flex-1 px-3 py-2 rounded-lg text-center text-xs font-medium"
                        style={{
                          background: isActive ? 'var(--teal-dim)' : isDone ? 'rgba(0,188,180,0.08)' : 'var(--surface-2)',
                          color: isActive ? 'var(--teal)' : isDone ? 'rgba(0,188,180,0.5)' : 'rgba(245,244,240,0.3)',
                          border: `1px solid ${isActive ? 'var(--teal)' : 'transparent'}`,
                        }}
                      >
                        {stage.label}
                      </div>
                      {i < STAGES.length - 1 && (
                        <div className="w-4 h-px mx-1" style={{ background: 'var(--border)' }} />
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-center text-xs" style={{ color: 'rgba(245,244,240,0.4)' }}>
                Generating your {format.toUpperCase()} package...
              </p>
            </div>
          ) : (
            /* Complete State */
            <div className="py-6 text-center">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-4" style={{ color: 'var(--green-ok)' }} />
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--off-white)' }}>Download started</p>
              <p className="text-xs mb-6" style={{ color: 'rgba(245,244,240,0.45)' }}>
                Your submission package has been generated and logged in the audit trail.
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-2 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--surface-2)', color: 'var(--off-white)', border: 'none', cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
