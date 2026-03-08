'use client';

import { CheckCircle, Clock, Circle } from 'lucide-react';
import type { TabId } from '@/hooks/useProjectHash';

interface SectionStatus {
  section: string;
  label: string;
  status: 'approved' | 'in_progress' | 'missing';
}

interface SectionsChecklistProps {
  sections: SectionStatus[];
  onTabSwitch: (tab: TabId) => void;
}

function formatSectionLabel(section: string) {
  return section.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function SectionsChecklist({ sections, onTabSwitch }: SectionsChecklistProps) {
  return (
    <div className="space-y-2">
      {sections.map(({ section, status }) => (
        <div
          key={section}
          className="flex items-center gap-3 px-3 py-2 rounded-lg"
          style={{ background: 'var(--surface)' }}
        >
          {status === 'approved' && (
            <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--green-ok)' }} />
          )}
          {status === 'in_progress' && (
            <Clock className="h-4 w-4 flex-shrink-0 animate-pulse" style={{ color: 'var(--amber)' }} />
          )}
          {status === 'missing' && (
            <Circle className="h-4 w-4 flex-shrink-0" style={{ color: 'rgba(245,244,240,0.2)' }} />
          )}

          <span
            className="text-sm flex-1"
            style={{ color: status === 'approved' ? 'var(--off-white)' : 'rgba(245,244,240,0.5)' }}
          >
            {formatSectionLabel(section)}
          </span>

          {status === 'approved' && (
            <span className="text-xs font-medium" style={{ color: 'var(--green-ok)' }}>Approved</span>
          )}
          {status === 'in_progress' && (
            <span className="text-xs font-medium" style={{ color: 'var(--amber)' }}>In progress</span>
          )}
          {status === 'missing' && (
            <button
              onClick={() => onTabSwitch('drafts')}
              className="text-xs font-medium px-2 py-0.5 rounded transition-opacity hover:opacity-80"
              style={{ background: 'var(--teal-dim)', color: 'var(--teal)' }}
            >
              Generate
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export { formatSectionLabel };
