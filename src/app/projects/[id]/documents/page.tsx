'use client';

import { useState, useEffect, useRef } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Upload, FileText, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

interface Document {
  id: string;
  name: string;
  sourceType: string;
  mimeType: string;
  fileSize: number;
  ingestionStatus: string;
  ingestionError?: string;
  ingestedAt?: string;
  createdAt: string;
}

export default function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    params.then(p => {
      setProjectId(p.id);
      fetchDocuments(p.id);
    });
  }, [params]);

  async function fetchDocuments(id: string) {
    const res = await fetch(`/api/projects/${id}/documents`);
    const data = await res.json();
    setDocuments(data.documents ?? []);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceType', 'user_upload');

      const res = await fetch(`/api/projects/${projectId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Upload failed');
      }

      await fetchDocuments(projectId);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar projectId={projectId} />
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
              <p className="text-gray-500 mt-1">Upload engineering files, SOPs, test reports, and standards excerpts</p>
            </div>
            <button onClick={() => fetchDocuments(projectId)} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Upload zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors mb-8 ${
              dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-700 font-medium">Drop files here or click to upload</p>
            <p className="text-sm text-gray-500 mt-1">PDF, DOCX, TXT, MD, CSV — up to 50 MB</p>
            {uploading && <p className="text-sm text-blue-600 mt-2">Uploading and queuing for ingestion...</p>}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.txt,.md,.csv"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
            />
          </div>

          {uploadError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-6">{uploadError}</div>
          )}

          <p className="text-xs text-gray-500 mb-4">
            Note: Scanned PDFs without a text layer cannot be ingested. Ensure PDFs contain selectable text.
          </p>

          {/* Document list */}
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {documents.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No documents uploaded yet</p>
              </div>
            ) : (
              documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-4 p-4">
                  <IngestionStatusIcon status={doc.ingestionStatus} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{doc.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {doc.sourceType} · {doc.mimeType} · {formatBytes(doc.fileSize)}
                    </p>
                    {doc.ingestionError && (
                      <p className="text-xs text-red-600 mt-1">{doc.ingestionError}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusBadgeClass(doc.ingestionStatus)}`}>
                    {doc.ingestionStatus}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function IngestionStatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />;
  if (status === 'failed') return <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />;
  return <Clock className="h-5 w-5 text-amber-500 flex-shrink-0 animate-pulse" />;
}

function statusBadgeClass(status: string) {
  if (status === 'completed') return 'bg-green-100 text-green-700';
  if (status === 'failed') return 'bg-red-100 text-red-700';
  if (status === 'processing') return 'bg-blue-100 text-blue-700';
  return 'bg-gray-100 text-gray-600';
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
