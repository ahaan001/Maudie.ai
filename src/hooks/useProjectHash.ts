'use client';

import { useState, useEffect, useCallback } from 'react';

export type TabId = 'overview' | 'documents' | 'intelligence' | 'risk' | 'drafts' | 'review' | 'audit';

const VALID_TABS: TabId[] = ['overview', 'documents', 'intelligence', 'risk', 'drafts', 'review', 'audit'];

function parseHash(hash: string): TabId {
  const id = hash.replace('#', '') as TabId;
  return VALID_TABS.includes(id) ? id : 'overview';
}

export function useProjectHash() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  useEffect(() => {
    setActiveTab(parseHash(window.location.hash));

    const onHashChange = () => setActiveTab(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const setTab = useCallback((id: TabId) => {
    window.location.hash = '#' + id;
  }, []);

  return { activeTab, setTab };
}
