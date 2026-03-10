'use client';

import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, ChevronDown, ChevronUp, FileText, Pencil, Trash2, Check, X } from 'lucide-react';
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
  const [duplicateName, setDuplicateName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadMsg(`Uploading ${file.name}...`);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/projects/${projectId}/documents`, { method: 'POST', body: form });

      if (res.status === 409) {
        const body = await res.json();
        setDuplicateName(body.document?.name ?? file.name);
        setUploadMsg('');
        return;
      }

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

  async function deleteDocument(docId: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      if (expandedDoc === docId) setExpandedDoc(null);
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  }

  function startRename(docId: string, currentName: string) {
    setRenamingId(docId);
    setRenameValue(currentName);
    setTimeout(() => renameInputRef.current?.select(), 0);
  }

  async function commitRename(docId: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenamingId(null); return; }
    setRenameLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error(await res.text());
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
    } catch (e) {
      console.error('Rename failed:', e);
    } finally {
      setRenameLoading(false);
      setRenamingId(null);
    }
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue('');
  }

  const deleteTarget = data?.documents?.find(d => d.id === deleteConfirmId);

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

      {/* Duplicate document popup */}
      {duplicateName && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setDuplicateName(null)}
        >
          <div
            className="rounded-xl p-6 max-w-sm w-full mx-4 space-y-4"
            style={{ background: 'var(--navy-900, #0d1117)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--off-white)' }}>
                  Document already exists
                </p>
                <p className="text-xs mt-1" style={{ color: 'rgba(245,244,240,0.5)' }}>
                  <span style={{ color: 'var(--off-white)' }}>{duplicateName}</span> has already been uploaded to this project. Duplicates are not allowed.
                </p>
              </div>
            </div>
            <button
              onClick={() => setDuplicateName(null)}
              className="w-full rounded-lg py-2 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--teal)', color: '#0d1117' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmId && deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="rounded-xl p-6 max-w-sm w-full mx-4 space-y-4"
            style={{ background: 'var(--navy-900, #0d1117)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <Trash2 className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--red-flag)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--off-white)' }}>Delete document?</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(245,244,240,0.5)' }}>
                  <span style={{ color: 'var(--off-white)' }}>{deleteTarget.name}</span> and all its chunks and citations will be permanently removed. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 rounded-lg py-2 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ background: 'var(--surface-2)', color: 'rgba(245,244,240,0.6)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteDocument(deleteConfirmId)}
                disabled={deleting}
                className="flex-1 rounded-lg py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: 'var(--red-flag)', color: '#fff' }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
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
                <React.Fragment key={doc.id}>
                  <tr
                    className="group cursor-pointer"
                    style={{ borderTop: '1px solid var(--border)' }}
                    onClick={() => {
                      if (renamingId === doc.id) return;
                      setExpandedDoc(expandedDoc === doc.id ? null : doc.id);
                    }}
                  >
                    {/* Name cell — switches to inline input when renaming */}
                    <td className="px-4 py-3">
                      {renamingId === doc.id ? (
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitRename(doc.id);
                              if (e.key === 'Escape') cancelRename();
                            }}
                            disabled={renameLoading}
                            autoFocus
                            className="rounded px-2 py-0.5 text-xs font-medium flex-1 min-w-0 outline-none"
                            style={{
                              background: 'var(--surface-2)',
                              border: '1px solid var(--teal)',
                              color: 'var(--off-white)',
                              maxWidth: '180px',
                            }}
                          />
                          <button
                            onClick={() => commitRename(doc.id)}
                            disabled={renameLoading}
                            className="p-0.5 rounded hover:opacity-80 disabled:opacity-40"
                            title="Save"
                          >
                            <Check className="h-3.5 w-3.5" style={{ color: 'var(--teal)' }} />
                          </button>
                          <button
                            onClick={cancelRename}
                            className="p-0.5 rounded hover:opacity-80"
                            title="Cancel"
                          >
                            <X className="h-3.5 w-3.5" style={{ color: 'rgba(245,244,240,0.4)' }} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'rgba(245,244,240,0.3)' }} />
                          <span className="text-xs font-medium truncate max-w-48" style={{ color: 'var(--off-white)' }}>{doc.name}</span>
                        </div>
                      )}
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

                    {/* Actions + chevron */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {renamingId !== doc.id && (
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); startRename(doc.id, doc.name); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/5"
                              title="Rename"
                            >
                              <Pencil className="h-3.5 w-3.5" style={{ color: 'rgba(245,244,240,0.45)' }} />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setDeleteConfirmId(doc.id); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/5"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--red-flag)' }} />
                            </button>
                          </>
                        )}
                        {expandedDoc === doc.id
                          ? <ChevronUp className="h-4 w-4" style={{ color: 'rgba(245,244,240,0.3)' }} />
                          : <ChevronDown className="h-4 w-4" style={{ color: 'rgba(245,244,240,0.3)' }} />
                        }
                      </div>
                    </td>
                  </tr>

                  {expandedDoc === doc.id && (
                    <tr>
                      <td colSpan={6} style={{ background: 'var(--surface)' }}>
                        <ChunkRow projectId={projectId} docId={doc.id} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
