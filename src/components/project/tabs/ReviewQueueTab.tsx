'use client';

import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useReviewTasks } from '@/hooks/useReviewTasks';
import { ReviewPanel } from '../review/ReviewPanel';
import { RiskBadge } from '../shared/RiskBadge';
import { StatusBadge } from '../shared/StatusBadge';
import { SkeletonList } from '../shared/SkeletonCard';
import { formatSectionLabel } from '../overview/SectionsChecklist';

interface ReviewQueueTabProps {
  projectId: string;
}

export function ReviewQueueTab({ projectId }: ReviewQueueTabProps) {
  const { data, isLoading } = useReviewTasks(projectId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const tasks = data?.tasks ?? [];
  const selectedTask = tasks.find(t => t.id === selectedTaskId) ?? null;

  function handleDone() {
    setSelectedTaskId(null);
  }

  return (
    <div className="flex gap-0 h-[calc(100vh-280px)] min-h-80">
      {/* Task List */}
      <div
        className="flex flex-col flex-shrink-0 overflow-y-auto"
        style={{
          width: 320,
          borderRight: '1px solid var(--border)',
          paddingRight: 0,
        }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-wider px-4 py-3 flex-shrink-0"
          style={{ color: 'rgba(245,244,240,0.4)', borderBottom: '1px solid var(--border)' }}
        >
          Pending Review ({tasks.length})
        </p>

        {isLoading ? (
          <div className="p-4">
            <SkeletonList count={4} variant="row" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
            <ClipboardCheck className="h-8 w-8 mb-3" style={{ color: 'rgba(245,244,240,0.15)' }} />
            <p className="text-sm" style={{ color: 'rgba(245,244,240,0.4)' }}>No pending reviews</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(245,244,240,0.25)' }}>
              All drafts have been reviewed or no drafts exist yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {tasks.map(task => (
              <button
                key={task.id}
                onClick={() => setSelectedTaskId(task.id === selectedTaskId ? null : task.id)}
                className="text-left px-4 py-3 flex flex-col gap-1.5 transition-colors"
                style={{
                  borderBottom: '1px solid var(--border)',
                  background: selectedTaskId === task.id ? 'var(--teal-glow)' : 'transparent',
                  borderLeft: selectedTaskId === task.id ? '2px solid var(--teal)' : '2px solid transparent',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--off-white)' }}>
                    {formatSectionLabel(task.draftId.slice(0, 8))}
                  </p>
                  <RiskBadge riskLevel={task.riskLevel} size="xs" />
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={task.status} size="xs" />
                  {task.flags?.length > 0 && (
                    <span className="text-[10px]" style={{ color: 'var(--red-flag)' }}>
                      {task.flags.length} flag{task.flags.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-[10px]" style={{ color: 'rgba(245,244,240,0.3)' }}>
                  {new Date(task.createdAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Review Panel */}
      <div className="flex-1 overflow-y-auto pl-6">
        {selectedTask ? (
          <ReviewPanel
            key={selectedTask.id}
            task={selectedTask}
            projectId={projectId}
            onDone={handleDone}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ClipboardCheck className="h-10 w-10 mb-4" style={{ color: 'rgba(245,244,240,0.1)' }} />
            <p className="text-sm" style={{ color: 'rgba(245,244,240,0.3)' }}>
              Select a review task from the left
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
