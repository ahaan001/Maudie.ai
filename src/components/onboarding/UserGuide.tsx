'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  FolderOpen,
  PlusCircle,
  FileText,
  ShieldAlert,
  ScrollText,
  BarChart2,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

const GUIDE_KEY = 'maudie_guide_done';

interface Step {
  icon: React.ElementType;
  title: string;
  description: string;
  detail: string;
  action?: { label: string; href: string };
  accentColor: string;
}

const STEPS: Step[] = [
  {
    icon: LayoutDashboard,
    title: 'Welcome to maudie.ai',
    description: 'Your AI-powered medical device compliance platform.',
    detail:
      'maudie.ai helps medical device teams navigate the regulatory process — from 510(k) submissions to CE marking. This guide will walk you through the key features so you can hit the ground running.',
    accentColor: 'var(--teal)',
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    description: 'Your compliance command center.',
    detail:
      'The Dashboard gives you a real-time overview of all your active projects, recent agent activity, and open review tasks. It\'s your starting point every time you log in.',
    action: { label: 'Go to Dashboard', href: '/dashboard' },
    accentColor: 'var(--teal)',
  },
  {
    icon: FolderOpen,
    title: 'Projects',
    description: 'Each project maps to a regulatory submission.',
    detail:
      'A Project represents one device going through one regulatory pathway (e.g., ExoArm v2 → FDA 510(k)). Projects contain all your documents, risk analyses, and draft sections in one place.',
    action: { label: 'View Projects', href: '/projects' },
    accentColor: '#60a5fa',
  },
  {
    icon: PlusCircle,
    title: 'Creating a Project',
    description: 'Start with your device information.',
    detail:
      'When creating a project, enter your device name, intended use, device class, and target jurisdiction. maudie.ai will automatically load the relevant regulatory requirements for your device category.',
    action: { label: 'Create a Project', href: '/projects/new' },
    accentColor: 'var(--teal)',
  },
  {
    icon: FileText,
    title: 'Documents & Intelligence',
    description: 'Upload technical files and let AI extract insights.',
    detail:
      'Upload design files, bench test reports, clinical evaluations, and predicate comparisons. The Intelligence layer uses AI to extract relevant facts, link evidence to regulatory sections, and surface gaps in your submission.',
    accentColor: '#a78bfa',
  },
  {
    icon: ShieldAlert,
    title: 'Risk File',
    description: 'AI-assisted hazard identification and risk controls.',
    detail:
      'maudie.ai generates a draft risk file following ISO 14971. It identifies potential hazards, estimates severity and probability, and suggests risk controls — all traceable back to your uploaded evidence.',
    accentColor: 'var(--amber)',
  },
  {
    icon: ScrollText,
    title: 'Drafts',
    description: 'AI-generated regulatory document sections.',
    detail:
      'For each required section of your submission (510(k) summary, substantial equivalence, performance testing, etc.), maudie.ai generates a draft with inline citations. Your team reviews and approves each section before submission.',
    accentColor: 'var(--green-ok)',
  },
  {
    icon: BarChart2,
    title: 'Analytics',
    description: 'Track team productivity and submission progress.',
    detail:
      'The Analytics page shows document processing rates, agent performance, review throughput, and a timeline of project activity. Use it to identify bottlenecks before they delay your submission.',
    action: { label: 'View Analytics', href: '/analytics' },
    accentColor: '#f472b6',
  },
  {
    icon: CheckCircle2,
    title: "You're all set!",
    description: 'Start your first compliance project.',
    detail:
      'Begin by creating a new project, uploading your technical documentation, and letting maudie.ai do the heavy lifting. Your team can collaborate on reviews, and all changes are tracked in the audit trail.',
    action: { label: 'Create your first project', href: '/projects/new' },
    accentColor: 'var(--teal)',
  },
];

interface UserGuideProps {
  /** If true, shows the guide immediately (e.g. on first login). Otherwise shows only the trigger button. */
  autoOpen?: boolean;
}

export function UserGuide({ autoOpen = false }: UserGuideProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(true); // assume done until we check localStorage

  useEffect(() => {
    const isDone = localStorage.getItem(GUIDE_KEY) === 'true';
    setDone(isDone);
    if (autoOpen && !isDone) {
      setOpen(true);
    }
  }, [autoOpen]);

  function handleOpen() {
    setStep(0);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  function handleDone() {
    localStorage.setItem(GUIDE_KEY, 'true');
    setDone(true);
    setOpen(false);
  }

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      handleDone();
    }
  }

  function handleBack() {
    if (step > 0) setStep(s => s - 1);
  }

  function handleActionAndNext(href: string) {
    router.push(href);
    handleNext();
    setOpen(false);
  }

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        title="Open user guide"
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
        style={{ color: done ? 'rgba(245,244,240,0.3)' : 'var(--teal)' }}
        onMouseEnter={e => (e.currentTarget.style.color = done ? 'rgba(245,244,240,0.5)' : 'var(--teal)')}
        onMouseLeave={e => (e.currentTarget.style.color = done ? 'rgba(245,244,240,0.3)' : 'var(--teal)')}
      >
        <HelpCircle className="h-3.5 w-3.5 flex-shrink-0" />
        <span>{done ? 'Help & Guide' : 'Get started guide'}</span>
        {!done && (
          <span
            className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--teal-dim)', color: 'var(--teal)' }}
          >
            NEW
          </span>
        )}
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(10,15,30,0.85)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: 'var(--navy-700)', border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
          >
            {/* Close */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
              style={{ color: 'rgba(245,244,240,0.4)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--off-white)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,244,240,0.4)')}
            >
              <X className="h-4 w-4" />
            </button>

            {/* Progress bar */}
            <div className="h-1 w-full" style={{ background: 'var(--surface-2)' }}>
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${((step + 1) / STEPS.length) * 100}%`,
                  background: current.accentColor,
                }}
              />
            </div>

            {/* Content */}
            <div className="p-8">
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: `${current.accentColor}18`, border: `1px solid ${current.accentColor}30` }}
              >
                <Icon className="h-6 w-6" style={{ color: current.accentColor }} />
              </div>

              {/* Step counter */}
              <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: 'rgba(245,244,240,0.35)' }}>
                Step {step + 1} of {STEPS.length}
              </p>

              <h2 className="text-2xl mb-2" style={{ fontFamily: 'var(--font-instrument-serif)', color: 'var(--off-white)' }}>
                {current.title}
              </h2>
              <p className="text-sm font-medium mb-4" style={{ color: current.accentColor }}>
                {current.description}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(245,244,240,0.65)' }}>
                {current.detail}
              </p>

              {/* Step dots */}
              <div className="flex gap-1.5 mt-6 mb-6">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className="rounded-full transition-all"
                    style={{
                      width: i === step ? 20 : 6,
                      height: 6,
                      background: i === step ? current.accentColor : 'rgba(255,255,255,0.15)',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-8 py-5"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <button
                onClick={handleBack}
                disabled={step === 0}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-colors disabled:opacity-30"
                style={{ color: 'rgba(245,244,240,0.6)' }}
                onMouseEnter={e => { if (step > 0) e.currentTarget.style.color = 'var(--off-white)'; }}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,244,240,0.6)')}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>

              <div className="flex gap-2">
                {current.action && !isLast && (
                  <button
                    onClick={() => handleActionAndNext(current.action!.href)}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      border: `1px solid ${current.accentColor}`,
                      color: current.accentColor,
                      background: 'transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${current.accentColor}14`)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {current.action.label}
                  </button>
                )}

                <button
                  onClick={isLast && current.action ? () => handleActionAndNext(current.action!.href) : handleNext}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: current.accentColor, color: 'var(--navy)' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  {isLast ? (current.action ? current.action.label : 'Done') : 'Next'}
                  {!isLast && <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
