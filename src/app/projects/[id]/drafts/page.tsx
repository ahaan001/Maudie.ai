'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import Link from 'next/link';
import { Plus, ScrollText, CheckCircle, Clock, AlertTriangle, RefreshCw, ChevronRight } from 'lucide-react';

const SECTION_TYPES = [
  { value: 'device_description', label: 'Device Description' },
  { value: 'intended_use', label: 'Intended Use / Indications for Use' },
  { value: 'contraindications', label: 'Contraindications' },
  { value: 'risk_assessment_overview', label: 'Risk Assessment Overview' },
  { value: 'failure_mode_summary', label: 'Failure Mode Summary' },
  { value: 'software_description', label: 'Software Description' },
  { value: 'test_summary', label: 'Test Summary' },
  { value: 'dhf_index', label: 'Design History File Index' },
];

export default function DraftsPage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = useState('');
  const [drafts, setDrafts] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedSection, setSelectedSection] = useState('device_description');
  const [showModal, setShowModal] = useState(false);
  const [jobId, setJobId] = useState('');

  useEffect(() => {
    params.then(p => {
      setProjectId(p.id);
      fetchDrafts(p.id);
    });
  }, [params]);

  async function fetchDrafts(id: string) {
    const res = await fetch(`/api/projects/${id}/drafts`);
    const data = await res.json();
    setDrafts(data.drafts ?? []);
  }

  async function generateDraft() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/agents/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'documentation_drafting',
          params: { sectionType: selectedSection },
        }),
      });
      const data = await res.json();
      setJobId(data.jobId ?? '');
      setShowModal(false);
      // Poll for completion
      setTimeout(() => fetchDrafts(projectId), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar projectId={projectId} />
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Documentation Drafts</h1>
              <p className="text-gray-500 mt-1">AI-generated draft sections with citation traceability</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => fetchDrafts(projectId)} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Generate Draft
              </button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
            <p className="text-xs text-amber-700">
              Drafts require Ollama (Mistral 7B) running locally and at least 3 ingested documents. Generation may take 1-2 minutes on CPU.
            </p>
          </div>

          {jobId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <p className="text-xs text-blue-700">Draft generation queued (job: {jobId}). Refresh in ~60 seconds to see result.</p>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {drafts.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No drafts generated yet</p>
                <p className="text-sm mt-1">Upload and ingest documents, then generate your first draft</p>
              </div>
            ) : (
              drafts.map(draft => (
                <Link key={draft.id} href={`/projects/${projectId}/drafts/${draft.id}`}>
                  <div className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer">
                    <DraftStatusIcon status={draft.status} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900">{draft.title ?? draft.sectionType}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {draft.sectionCount} section(s) ·
                        {draft.reviewTask && ` ${draft.reviewTask.riskLevel} risk ·`}
                        {new Date(draft.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${draftStatusClass(draft.status)}`}>
                      {draft.status}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Generate modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
              <h2 className="text-lg font-semibold mb-4">Generate Draft Section</h2>
              <label className="block text-sm font-medium text-gray-700 mb-2">Section Type</label>
              <select
                className="input w-full mb-4"
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
              >
                {SECTION_TYPES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mb-6">
                The agent will retrieve relevant context from your knowledge base and generate a traceable draft.
                Intended Use and Contraindications sections always require human review.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={generateDraft}
                  disabled={generating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {generating ? 'Queuing...' : 'Generate'}
                </button>
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DraftStatusIcon({ status }: { status: string }) {
  if (status === 'approved') return <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />;
  if (status === 'rejected') return <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />;
  return <Clock className="h-5 w-5 text-amber-500 flex-shrink-0" />;
}

function draftStatusClass(status: string) {
  if (status === 'approved') return 'bg-green-100 text-green-700';
  if (status === 'rejected') return 'bg-red-100 text-red-700';
  if (status === 'in_review') return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-600';
}
