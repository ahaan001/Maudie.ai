'use client';

import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { useDocuments } from '@/hooks/useDocuments';
import { useChunks } from '@/hooks/useChunks';
import { StatusBadge } from '../shared/StatusBadge';
import { SkeletonList } from '../shared/SkeletonCard';

interface DocumentsTabProps {
  projectId: string;
}

const SOURCE_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  user_upload: { color: 'rgba(245,244,240,0.6)', bg: 'var(--surface-2)' },
  maude:       { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  standard:    { color: 'var(--teal)',  bg: 'var(--teal-dim)' },
  internal:    { color: 'var(--amber)', bg: 'var(--amber-dim)' },
  bom:         { color: 'var(--green-ok)', bg: 'var(--green-dim)' },
};

function SourceTypeBadge({ type }: { type: string }) {
  const cfg = SOURCE_TYPE_COLORS[type] ?? { color: 'var(--off-white)', bg: 'var(--surface-2)' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {type.replace(/_/g, ' ')}
    </span>
  );
}

function ChunkRow({ projectId, docId }: { projectId: string; docId: string }) {
  const { data, isLoading } = useChunks(projectId, docId, true);
  if (isLoading) return <div className="px-6 py-2 text-xs animate-pulse" style={{ color: 'rgba(245,244,240,0.3)' }}>Loading chunks...</div>;

  return (
    <div className="px-6 py-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
      {(data?.chunks ?? []).map(chunk => (
        <div key={chunk.id} className="rounded-lg p-2.5" style={{ background: 'var(--navy-800)' }}>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[10px] font-mono" style={{ color: 'var(--teal)' }}>Chunk #{chunk.chunkIndex}</span>
            <span className="text-[10px]" style={{ color: 'rgba(245,244,240,0.3)' }}>{chunk.tokenCount} tokens</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(245,244,240,0.6)' }}>
            {chunk.content}
          </p>
        </div>
      ))}
      {data?.chunks?.length === 0 && (
        <p className="text-xs" style={{ color: 'rgba(245,244,240,0.3)' }}>No chunks yet — document may still be processing.</p>
      )}
    </div>
  );
}

export function DocumentsTab({ projectId }: DocumentsTabProps) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useDocuments(projectId);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadMsg(`Uploading ${file.name}...`);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/projects/${projectId}/documents`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      setUploadMsg(`${file.name} uploaded.`);
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
    } catch (e) {
      setUploadMsg(`Upload failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className="rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center gap-3 p-10"
        style={{
          border: `2px dashed ${isDragging ? 'var(--teal)' : 'var(--border)'}`,
          background: isDragging ? 'var(--teal-glow)' : 'var(--surface)',
        }}
      >
        <Upload className="h-8 w-8" style={{ color: isDragging ? 'var(--teal)' : 'rgba(245,244,240,0.3)' }} />
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: 'rgba(245,244,240,0.6)' }}>
            {uploading ? uploadMsg : 'Drop files here or click to upload'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'rgba(245,244,240,0.3)' }}>
            PDF, DOCX, TXT, MD, CSV — up to 50MB
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.txt,.md,.csv"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
        />
      </div>

      {uploadMsg && !uploading && (
        <p className="text-xs" style={{ color: 'var(--teal)' }}>{uploadMsg}</p>
      )}

      {/* File Table */}
      {isLoading ? (
        <SkeletonList count={4} variant="row" />
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                {['Name', 'Type', 'Source', 'Uploaded', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(245,244,240,0.35)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.documents ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'rgba(245,244,240,0.3)' }}>
                    No documents yet. Upload your first document above.
                  </td>
                </tr>
              )}
              {(data?.documents ?? []).map(doc => (
                <>
                  <tr
                    key={doc.id}
                    className="cursor-pointer"
                    style={{ borderTop: '1px solid var(--border)' }}
                    onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'rgba(245,244,240,0.3)' }} />
                        <span className="text-xs font-medium truncate max-w-48" style={{ color: 'var(--off-white)' }}>{doc.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'rgba(245,244,240,0.5)' }}>
                      {doc.mimeType?.split('/')[1]?.toUpperCase() ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <SourceTypeBadge type={doc.sourceType} />
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'rgba(245,244,240,0.4)' }}>
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={doc.ingestionStatus} size="xs" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {expandedDoc === doc.id
                        ? <ChevronUp className="h-4 w-4 inline" style={{ color: 'rgba(245,244,240,0.3)' }} />
                        : <ChevronDown className="h-4 w-4 inline" style={{ color: 'rgba(245,244,240,0.3)' }} />
                      }
                    </td>
                  </tr>
                  {expandedDoc === doc.id && (
                    <tr key={`${doc.id}-chunks`}>
                      <td colSpan={6} style={{ background: 'var(--surface)' }}>
                        <ChunkRow projectId={projectId} docId={doc.id} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
