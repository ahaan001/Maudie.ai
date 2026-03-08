'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, ArrowUpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useDraftContent } from '@/hooks/useDraftContent';
import type { ReviewTaskRecord } from '@/hooks/useReviewTasks';
import { FlagsList } from './FlagsList';
import { DiffViewer } from './DiffViewer';
import { RiskBadge } from '../shared/RiskBadge';
import { SkeletonList } from '../shared/SkeletonCard';
import { hasRole } from '@/lib/auth/permissions';
import type { OrgRole } from '@/lib/db/schema';

interface ReviewPanelProps {
  task: ReviewTaskRecord;
  projectId: string;
  onDone: () => void;
}

export function ReviewPanel({ task, projectId, onDone }: ReviewPanelProps) {
  const queryClient = useQueryClient();
  const { data: sessionData } = useSession();
  const { data, isLoading } = useDraftContent(task.draftId);
  const canApprove = hasRole((sessionData?.user?.orgRole as OrgRole | null | undefined), 'reviewer');
  const [editedContent, setEditedContent] = useState('');
  const [comments, setComments] = useState('');
  const [showDiff, setShowDiff] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const originalContent = data?.sections?.[0]?.content ?? '';

  useEffect(() => {
    setEditedContent(originalContent);
    setComments('');
    setShowDiff(false);
    setError('');
  }, [task.id, originalContent]);

  const isDirty = editedContent !== originalContent && originalContent !== '';

  async function submit(action: 'approve' | 'reject' | 'escalate') {
    setSubmitting(true);
    setError('');
    try {
      const endpoint = action === 'approve'
        ? `/api/review/tasks/${task.id}/approve`
        : `/api/review/tasks/${task.id}/reject`;

      const body: Record<string, unknown> = { comments };
      if (action === 'approve' && isDirty) body.editedContent = editedContent;
      if (action === 'escalate') body.escalate = true;

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());

      queryClient.invalidateQueries({ queryKey: ['review-tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['compliance-score', projectId] });
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] });
      if (data?.draft?.id) {
        queryClient.invalidateQueries({ queryKey: ['draft-content', data.draft.id] });
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--off-white)' }}>
            {data?.draft?.sectionType?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? 'Loading...'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(245,244,240,0.4)' }}>
            Draft ID: {task.draftId.slice(0, 8)}
          </p>
        </div>
        <div className="ml-auto">
          <RiskBadge riskLevel={task.riskLevel} />
        </div>
      </div>

      {/* Flags */}
      {task.flags?.length > 0 && (
        <div className="flex-shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(245,244,240,0.4)' }}>
            Flags ({task.flags.length})
          </p>
          <FlagsList flags={task.flags} />
        </div>
      )}

      {/* Content editor */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <p className="text-xs font-semibold uppercase tracking-wider flex-shrink-0" style={{ color: 'rgba(245,244,240,0.4)' }}>
          Draft Content
        </p>
        {isLoading ? (
          <SkeletonList count={4} />
        ) : (
          <textarea
            className="flex-1 text-xs leading-relaxed p-3 rounded-lg resize-none font-mono min-h-[160px]"
            style={{
              background: 'var(--navy-800)',
              border: '1px solid var(--border)',
              color: 'var(--off-white)',
              outline: 'none',
            }}
            value={editedContent}
            onChange={e => setEditedContent(e.target.value)}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--teal)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        )}
      </div>

      {/* Diff toggle */}
      {isDirty && (
        <div className="flex-shrink-0">
          <button
            onClick={() => setShowDiff(v => !v)}
            className="flex items-center gap-1.5 text-xs mb-2"
            style={{ color: 'var(--teal)' }}
          >
            {showDiff ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showDiff ? 'Hide' : 'Show'} diff
          </button>
          {showDiff && <DiffViewer original={originalContent} modified={editedContent} />}
        </div>
      )}

      {/* Comments */}
      <div className="flex-shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(245,244,240,0.4)' }}>
          Comments
        </p>
        <textarea
          className="w-full text-xs p-2.5 rounded-lg resize-none h-16"
          placeholder="Add review notes..."
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--off-white)',
            outline: 'none',
          }}
          value={comments}
          onChange={e => setComments(e.target.value)}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--teal)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
      </div>

      {error && (
        <p className="text-xs flex-shrink-0" style={{ color: 'var(--red-flag)' }}>{error}</p>
      )}

      {/* Actions */}
      {canApprove ? (
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => submit('approve')}
            disabled={submitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
            style={{ background: 'var(--green-dim)', color: 'var(--green-ok)' }}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Approve
          </button>
          <button
            onClick={() => submit('reject')}
            disabled={submitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
            style={{ background: 'var(--red-dim)', color: 'var(--red-flag)' }}
          >
            <XCircle className="h-3.5 w-3.5" />
            Reject
          </button>
          <button
            onClick={() => submit('escalate')}
            disabled={submitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
            style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}
          >
            <ArrowUpCircle className="h-3.5 w-3.5" />
            Escalate
          </button>
        </div>
      ) : (
        <p className="text-xs flex-shrink-0" style={{ color: 'rgba(245,244,240,0.35)' }}>
          Reviewer role required to approve or reject drafts.
        </p>
      )}
    </div>
  );
}
