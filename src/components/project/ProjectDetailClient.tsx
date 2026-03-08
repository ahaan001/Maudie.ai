'use client';

import { useState } from 'react';
import { useProjectHash } from '@/hooks/useProjectHash';
import { DraftGenerationModal } from './drafts/DraftGenerationModal';
import { ExportModal } from './export/ExportModal';
import { useProjectSummary } from '@/hooks/useProjectSummary';
import { useComplianceScore } from '@/hooks/useComplianceScore';
import { ProjectHeader } from './ProjectHeader';
import { ProjectTabBar } from './ProjectTabBar';
import { OverviewTab } from './tabs/OverviewTab';
import { DocumentsTab } from './tabs/DocumentsTab';
import { IntelligenceTab } from './tabs/IntelligenceTab';
import { DraftsTab } from './tabs/DraftsTab';
import { ReviewQueueTab } from './tabs/ReviewQueueTab';
import { AuditTrailTab } from './tabs/AuditTrailTab';
import { RiskTab } from './tabs/RiskTab';
import { SkeletonCard } from './shared/SkeletonCard';
import { Download } from 'lucide-react';
import type { RegulatoryProfile } from '@/types/regulatory';
import type { ProjectSummary } from '@/hooks/useProjectSummary';

interface ProjectDetailClientProps {
  projectId: string;
  initialProject: ProjectSummary['project'];
  initialDevice: ProjectSummary['device'];
  regulatoryProfile: RegulatoryProfile;
}

export function ProjectDetailClient({
  projectId,
  initialProject,
  initialDevice,
  regulatoryProfile,
}: ProjectDetailClientProps) {
  const { activeTab, setTab } = useProjectHash();
  const { data: complianceScore } = useComplianceScore(projectId);
  const [exportOpen, setExportOpen] = useState(false);
  const { data: summary, isLoading } = useProjectSummary(projectId, {
    project: initialProject,
    device: initialDevice,
    documentCount: 0,
    clusterCount: 0,
    drafts: [],
    pendingReviewCount: 0,
    lastIntelligenceRun: null,
  });

  // Compute project health
  const drafts = summary?.drafts ?? [];
  const approvedCount = drafts.filter(d => d.status === 'approved').length;
  const requiredCount = regulatoryProfile.required_sections.length;
  const healthPct = requiredCount > 0 ? Math.round((approvedCount / requiredCount) * 100) : 0;

  return (
    <div>
      {/* Project Header */}
      {isLoading && !initialProject ? (
        <SkeletonCard variant="header" />
      ) : (
        <ProjectHeader
          name={summary?.project.name ?? initialProject.name}
          description={summary?.project.description ?? initialProject.description}
          deviceName={summary?.device?.name ?? initialDevice?.name}
          deviceClass={summary?.device?.deviceClass ?? initialDevice?.deviceClass ?? regulatoryProfile.device_class_default}
          jurisdiction={summary?.project.jurisdiction ?? initialProject.jurisdiction}
          deviceCategory={summary?.project.deviceCategory ?? initialProject.deviceCategory}
          healthPct={complianceScore?.score ?? healthPct}
          regulatoryProfile={regulatoryProfile}
        />
      )}

      {/* Export Package button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setExportOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{
            background: 'var(--teal-dim)',
            color: 'var(--teal)',
            border: '1px solid rgba(0,188,180,0.3)',
            cursor: 'pointer',
          }}
        >
          <Download className="h-4 w-4" />
          Export Package
        </button>
      </div>

      {/* Tab Bar */}
      <ProjectTabBar activeTab={activeTab} onTabChange={setTab} />

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          projectId={projectId}
          summary={summary}
          isLoading={isLoading}
          regulatoryProfile={regulatoryProfile}
          onTabSwitch={setTab}
        />
      )}

      {activeTab === 'documents' && (
        <DocumentsTab projectId={projectId} />
      )}

      {activeTab === 'intelligence' && (
        <IntelligenceTab
          projectId={projectId}
          lastIntelligenceRun={summary?.lastIntelligenceRun ?? null}
        />
      )}

      {activeTab === 'risk' && (
        <RiskTab projectId={projectId} />
      )}

      {activeTab === 'drafts' && (
        <DraftsTab
          projectId={projectId}
          regulatoryProfile={regulatoryProfile}
        />
      )}

      {activeTab === 'review' && (
        <ReviewQueueTab projectId={projectId} />
      )}

      {activeTab === 'audit' && (
        <AuditTrailTab projectId={projectId} />
      )}

      {/* Modals — rendered above all tabs */}
      <DraftGenerationModal
        onViewDraft={() => setTab('drafts')}
        onViewReview={() => setTab('review')}
      />
      <ExportModal
        projectId={projectId}
        open={exportOpen}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}
