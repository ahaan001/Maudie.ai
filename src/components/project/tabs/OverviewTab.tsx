'use client';

import { ComplianceTimeline } from '../overview/ComplianceTimeline';
import { RequirementsChecklist } from '../overview/RequirementsChecklist';
import { SkeletonList } from '../shared/SkeletonCard';
import { useRequirements } from '@/hooks/useRequirements';
import type { TabId } from '@/hooks/useProjectHash';
import type { ProjectSummary } from '@/hooks/useProjectSummary';
import type { RegulatoryProfile } from '@/types/regulatory';

interface OverviewTabProps {
  projectId: string;
  summary: ProjectSummary | undefined;
  isLoading: boolean;
  regulatoryProfile: RegulatoryProfile;
  onTabSwitch: (tab: TabId) => void;
}

export function OverviewTab({ projectId, summary, isLoading, regulatoryProfile, onTabSwitch }: OverviewTabProps) {
  const { data: reqData, isLoading: isLoadingReqs } = useRequirements(projectId);
  const drafts = summary?.drafts ?? [];
  const approvedSections = new Set(
    drafts.filter(d => d.status === 'approved').map(d => d.sectionType)
  );

  const allRequiredApproved =
    regulatoryProfile.required_sections.length > 0 &&
    regulatoryProfile.required_sections.every(s => approvedSections.has(s));

  const stages = [
    {
      label: 'Project Created',
      detail: summary?.project.createdAt
        ? new Date(summary.project.createdAt).toLocaleDateString()
        : '—',
      done: true,
    },
    {
      label: 'Documents Uploaded',
      detail: summary ? `${summary.documentCount} document${summary.documentCount !== 1 ? 's' : ''}` : '—',
      done: (summary?.documentCount ?? 0) > 0,
      ctaLabel: 'Upload Documents',
      ctaTab: 'documents' as TabId,
    },
    {
      label: 'Intelligence Run',
      detail: summary ? `${summary.clusterCount} failure cluster${summary.clusterCount !== 1 ? 's' : ''}` : '—',
      done: (summary?.clusterCount ?? 0) > 0,
      ctaLabel: 'Run Analysis',
      ctaTab: 'intelligence' as TabId,
    },
    {
      label: 'Drafts Generated',
      detail: summary ? `${drafts.length} draft${drafts.length !== 1 ? 's' : ''}` : '—',
      done: drafts.length > 0,
      ctaLabel: 'Generate Drafts',
      ctaTab: 'drafts' as TabId,
    },
    {
      label: 'Review Complete',
      detail: allRequiredApproved
        ? 'All required sections approved'
        : `${approvedSections.size} / ${regulatoryProfile.required_sections.length} sections approved`,
      done: allRequiredApproved,
      ctaLabel: 'Go to Review',
      ctaTab: 'review' as TabId,
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Compliance Timeline */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'rgba(245,244,240,0.4)' }}>
          Compliance Progress
        </h3>
        {isLoading ? (
          <SkeletonList count={5} variant="timeline" />
        ) : (
          <ComplianceTimeline stages={stages} onTabSwitch={onTabSwitch} />
        )}
      </div>

      {/* Requirements Checklist */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'rgba(245,244,240,0.4)' }}>
          Required Sections
        </h3>
        <RequirementsChecklist
          grouped={reqData?.grouped ?? {}}
          isLoading={isLoadingReqs}
          projectId={projectId}
          onTabSwitch={onTabSwitch}
        />
      </div>
    </div>
  );
}
