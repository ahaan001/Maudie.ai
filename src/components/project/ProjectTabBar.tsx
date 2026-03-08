'use client';

import type { TabId } from '@/hooks/useProjectHash';

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: 'overview',      label: 'Overview' },
  { id: 'documents',     label: 'Documents' },
  { id: 'intelligence',  label: 'Intelligence' },
  { id: 'risk',          label: 'Risk File' },
  { id: 'drafts',        label: 'Drafts' },
  { id: 'review',        label: 'Review Queue' },
  { id: 'audit',         label: 'Audit Trail' },
];

interface ProjectTabBarProps {
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
}

export function ProjectTabBar({ activeTab, onTabChange }: ProjectTabBarProps) {
  return (
    <div
      className="sticky top-0 z-20 flex overflow-x-auto gap-0 -mx-8 px-8 mb-8"
      style={{
        background: 'var(--navy)',
        borderBottom: '1px solid var(--border)',
        scrollbarWidth: 'none',
      }}
    >
      {TABS.map(tab => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="relative flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap"
            style={{
              color: isActive ? 'var(--off-white)' : 'rgba(245,244,240,0.4)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderBottom: isActive ? '2px solid var(--teal)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
