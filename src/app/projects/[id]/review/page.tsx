'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { ClipboardCheck, AlertTriangle, CheckCircle, Clock, XCircle, RefreshCw } from 'lucide-react';

interface ReviewTask {
  id: string;
  projectId: string;
  draftId: string;
  status: string;
  riskLevel: string;
  flags: Array<{ type: string; description: string; location: string; severity: string }>;
  createdAt: string;
  draftSectionType?: string;
  draftTitle?: string;
}

export default function ReviewQueuePage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = useState('');
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [selected, setSelected] = useState<ReviewTask | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [comments, setComments] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    params.then(p => {
      setProjectId(p.id);
      fetchTasks(p.id);
    });
  }, [params]);

  async function fetchTasks(id: string) {
    const res = await fetch(`/api/review/tasks?projectId=${id}&status=pending`);
    const data = await res.json();
    setTasks(data.tasks ?? []);
  }

  async function selectTask(task: ReviewTask) {
    setSelected(task);
    setComments('');

    const res = await fetch(`/api/drafts/${task.draftId}`);
    const data = await res.json();
    const content = data.sections?.[0]?.content ?? '';
    setDraftContent(content);
    setEditedContent(content);
  }

  async function handleAction(action: 'approved' | 'rejected') {
    if (!selected) return;
    setProcessing(true);

    try {
      const endpoint = `/api/review/tasks/${selected.id}/${action === 'approved' ? 'approve' : 'reject'}`;
      const body = action === 'approved'
        ? { approvedBy: 'reviewer', editedContent: editedContent !== draftContent ? editedContent : undefined, comments }
        : { rejectedBy: 'reviewer', reason: comments || 'Rejected by reviewer' };

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Action failed');

      setSelected(null);
      fetchTasks(projectId);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar projectId={projectId} />
      <main className="flex-1 flex overflow-hidden">
        {/* Task list */}
        <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-amber-500" />
              Review Queue
            </h2>
            <button onClick={() => fetchTasks(projectId)} className="p-1 hover:bg-gray-100 rounded">
              <RefreshCw className="h-3 w-3 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {tasks.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No pending reviews</p>
              </div>
            ) : (
              tasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => selectTask(task)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${selected?.id === task.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {task.draftTitle ?? task.draftSectionType ?? 'Draft Section'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {task.flags.length} flag(s) · {new Date(task.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <RiskBadge level={task.riskLevel} />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Review panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Select a task to review</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-6 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selected.draftTitle ?? selected.draftSectionType}
                    </h2>
                    <div className="flex items-center gap-3 mt-1">
                      <RiskBadge level={selected.riskLevel} />
                      <span className="text-sm text-gray-500">{selected.flags.length} flag(s) found</span>
                    </div>
                  </div>
                </div>

                {/* Flags */}
                {selected.flags.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {selected.flags.map((flag, i) => (
                      <div key={i} className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                        flag.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-medium">{flag.type}: </span>
                          {flag.description}
                          {flag.location && <span className="opacity-75"> [{flag.location}]</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Draft Content (edit before approving)</h3>
                <textarea
                  className="w-full min-h-[300px] p-4 border border-gray-200 rounded-lg text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editedContent}
                  onChange={e => setEditedContent(e.target.value)}
                />

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Review Comments</label>
                  <textarea
                    className="w-full h-20 p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add notes about your review decision..."
                    value={comments}
                    onChange={e => setComments(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => handleAction('approved')}
                    disabled={processing}
                    className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction('rejected')}
                    disabled={processing}
                    className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>
                </div>

                <p className="text-xs text-gray-400 mt-3">
                  Your decision, the AI content hash, and any edits are permanently recorded in the audit log.
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const cls = level === 'high' ? 'bg-red-100 text-red-700' :
              level === 'medium' ? 'bg-amber-100 text-amber-700' :
              'bg-green-100 text-green-700';
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{level} risk</span>;
}
