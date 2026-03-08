'use client';

import { CheckCircle } from 'lucide-react';
import type { TabId } from '@/hooks/useProjectHash';

interface Stage {
  label: string;
  detail: string;
  done: boolean;
  ctaLabel?: string;
  ctaTab?: TabId;
}

interface ComplianceTimelineProps {
  stages: Stage[];
  onTabSwitch: (tab: TabId) => void;
}

export function ComplianceTimeline({ stages, onTabSwitch }: ComplianceTimelineProps) {
  return (
    <div className="relative">
      {/* Vertical connector line */}
      <div
        className="absolute left-[15px] top-5 bottom-5 w-px"
        style={{ background: 'var(--border)' }}
      />
      <div className="space-y-6">
        {stages.map((stage, i) => (
          <div key={i} className="flex items-start gap-4 relative">
            {/* Icon */}
            <div className="relative z-10 flex-shrink-0">
              {stage.done ? (
                <CheckCircle className="h-8 w-8" style={{ color: 'var(--green-ok)' }} />
              ) : (
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'rgba(245,244,240,0.4)',
                  }}
                >
                  {i + 1}
                </div>
              )}
            </div>
            {/* Content */}
            <div className="flex-1 pt-0.5">
              <p
                className="text-sm font-semibold"
                style={{ color: stage.done ? 'var(--off-white)' : 'rgba(245,244,240,0.5)' }}
              >
                {stage.label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(245,244,240,0.35)' }}>
                {stage.detail}
              </p>
              {!stage.done && stage.ctaLabel && stage.ctaTab && (
                <button
                  onClick={() => onTabSwitch(stage.ctaTab!)}
                  className="mt-2 text-xs font-medium px-3 py-1 rounded transition-opacity hover:opacity-80"
                  style={{ background: 'var(--teal-dim)', color: 'var(--teal)' }}
                >
                  {stage.ctaLabel} →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
