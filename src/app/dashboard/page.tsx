import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { ComplianceScoreCard } from '@/components/ui/ComplianceScoreRing';
import { PageMotion } from '@/components/ui/PageMotion';
import Link from 'next/link';
import { Plus, FolderOpen, ClipboardCheck, Shield, Activity, CheckCircle } from 'lucide-react';

const STEPS = [
  { label: 'Create project', description: 'Device info & regulatory profile' },
  { label: 'Upload documents', description: 'SOPs, specs, test reports, standards' },
  { label: 'Run intelligence', description: 'FDA MAUDE comparable device analysis' },
  { label: 'Generate drafts', description: 'AI documentation with citation traceability' },
  { label: 'Review & approve', description: 'Engineering sign-off via review queue' },
];

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-8">
          <PageMotion>
          <div className="max-w-5xl mx-auto">

            {/* Header */}
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--teal)', opacity: 0.8 }}>
                  maudie.ai
                </p>
                <h1 className="text-3xl" style={{ fontFamily: 'var(--font-instrument-serif)' }}>
                  Dashboard
                </h1>
              </div>
              <Link href="/projects/new" className="btn-teal">
                <Plus className="h-4 w-4" />
                New Project
              </Link>
            </div>

            {/* Regulatory disclaimer */}
            <div
              className="rounded-xl px-5 py-3 mb-8 flex items-start gap-3"
              style={{
                background: 'var(--amber-dim)',
                border: '1px solid rgba(245,166,35,0.2)',
              }}
            >
              <span className="text-sm mt-0.5" style={{ color: 'var(--amber)' }}>⚠</span>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--amber)' }}>
                <strong>Regulatory Disclaimer:</strong> All AI-generated content is a draft aid only.
                Engineering and regulatory review is required before use in any FDA submission or
                regulatory correspondence.
              </p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                icon={FolderOpen}
                label="Active Projects"
                value="—"
                accentColor="var(--teal)"
                accentDim="var(--teal-dim)"
              />
              <StatCard
                icon={ClipboardCheck}
                label="Pending Reviews"
                value="—"
                accentColor="var(--amber)"
                accentDim="var(--amber-dim)"
              />
              <StatCard
                icon={Shield}
                label="Approved Drafts"
                value="—"
                accentColor="var(--green-ok)"
                accentDim="var(--green-dim)"
              />
              <ComplianceScoreCard score={72} />
            </div>

            {/* Getting started — horizontal stepper */}
            <div className="glass-card rounded-xl p-6 mb-6">
              <h2
                className="text-lg mb-6"
                style={{ fontFamily: 'var(--font-instrument-serif)' }}
              >
                Getting Started
              </h2>
              <div className="relative">
                {/* Connecting line */}
                <div
                  className="absolute top-5 left-5 right-5 h-px hidden lg:block"
                  style={{ background: 'var(--border)' }}
                />
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {STEPS.map((step, i) => (
                    <StepItem key={i} step={step} index={i} completed={false} />
                  ))}
                </div>
              </div>
            </div>

            {/* System health */}
            <SystemHealthIndicator />
          </div>
          </PageMotion>
        </main>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accentColor,
  accentDim,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accentColor: string;
  accentDim: string;
}) {
  return (
    <div className="glass-card rounded-xl p-5">
      <div
        className="inline-flex p-2 rounded-lg mb-4"
        style={{ background: accentDim }}
      >
        <Icon className="h-4 w-4" style={{ color: accentColor }} />
      </div>
      <p
        className="text-2xl font-mono font-semibold"
        style={{ color: accentColor }}
      >
        {value}
      </p>
      <p className="text-xs mt-1.5 opacity-50">{label}</p>
    </div>
  );
}

function StepItem({
  step,
  index,
  completed,
}: {
  step: { label: string; description: string };
  index: number;
  completed: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center relative z-10">
      {/* Step circle */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-mono font-semibold mb-3 flex-shrink-0"
        style={{
          background: completed ? 'var(--teal)' : 'var(--surface-2)',
          border: completed ? 'none' : '1px solid var(--border)',
          color: completed ? 'var(--navy)' : 'rgba(245,244,240,0.5)',
        }}
      >
        {completed ? <CheckCircle className="h-5 w-5" /> : index + 1}
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--off-white)' }}>
        {step.label}
      </p>
      <p className="text-xs leading-relaxed opacity-40">{step.description}</p>
    </div>
  );
}

function SystemHealthIndicator() {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 opacity-40" />
        <span className="text-sm font-medium opacity-60">System Status</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatusDot label="Ollama (Mistral 7B)" />
        <StatusDot label="PostgreSQL + pgvector" />
      </div>
      <p className="text-xs mt-3 opacity-30">
        Check{' '}
        <code className="font-mono px-1 py-0.5 rounded" style={{ background: 'var(--surface-2)' }}>
          /api/health
        </code>{' '}
        for real-time status
      </p>
    </div>
  );
}

function StatusDot({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: 'rgba(245,244,240,0.2)' }}
      />
      <span className="text-xs opacity-40 font-mono">{label}</span>
    </div>
  );
}
