'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { Plus, FolderOpen, ChevronRight } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  deviceCategory: string;
  jurisdiction: string;
  regulatoryProfile: string;
  createdAt: string;
}

function getDeviceClassBorder(regulatoryProfile: string): string {
  const profile = regulatoryProfile.toLowerCase();
  if (profile.includes('class_iii') || profile.includes('surgical')) return '4px solid var(--red-flag)';
  if (profile.includes('class_ii') || profile.includes('wearable') || profile.includes('assistive')) return '4px solid var(--amber)';
  return '4px solid var(--green-ok)';
}

function getDeviceClassLabel(regulatoryProfile: string): { label: string; color: string } {
  const profile = regulatoryProfile.toLowerCase();
  if (profile.includes('class_iii') || profile.includes('surgical')) return { label: 'Class III', color: 'var(--red-flag)' };
  if (profile.includes('class_ii') || profile.includes('wearable') || profile.includes('assistive')) return { label: 'Class II', color: 'var(--amber)' };
  return { label: 'Class I', color: 'var(--green-ok)' };
}

function getJurisdictionBadge(jurisdiction: string): Array<{ label: string; bg: string; color: string }> {
  const j = jurisdiction.toLowerCase();
  const badges = [];
  if (j.includes('fda') || j.includes('us')) badges.push({ label: 'FDA', bg: 'var(--teal-dim)', color: 'var(--teal)' });
  if (j.includes('ce') || j.includes('eu')) badges.push({ label: 'CE', bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' });
  if (badges.length === 0) badges.push({ label: jurisdiction.toUpperCase(), bg: 'var(--surface-2)', color: 'rgba(245,244,240,0.5)' });
  return badges;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        setProjects(data.projects ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load projects');
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-8">
          <motion.div
            className="max-w-5xl mx-auto"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >

            {/* Header */}
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--teal)', opacity: 0.8 }}>
                  Compliance Projects
                </p>
                <h1 className="text-3xl" style={{ fontFamily: 'var(--font-instrument-serif)' }}>
                  Projects
                </h1>
              </div>
              <Link href="/projects/new" className="btn-teal">
                <Plus className="h-4 w-4" />
                New Project
              </Link>
            </div>

            {loading && (
              <div className="flex items-center gap-3 text-sm opacity-40">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--teal)' }} />
                Loading projects...
              </div>
            )}

            {error && (
              <div
                className="rounded-xl px-5 py-4 text-sm"
                style={{ background: 'var(--red-dim)', border: '1px solid rgba(224,82,82,0.2)', color: 'var(--red-flag)' }}
              >
                {error}
              </div>
            )}

            {!loading && !error && projects.length === 0 && (
              <div className="glass-card rounded-xl p-16 text-center">
                <FolderOpen className="h-10 w-10 mx-auto mb-4 opacity-20" />
                <p className="text-sm opacity-40 mb-6">No compliance projects yet.</p>
                <Link href="/projects/new" className="btn-teal">
                  <Plus className="h-4 w-4" />
                  Create your first project
                </Link>
              </div>
            )}

            {!loading && !error && projects.length > 0 && (
              <div className="space-y-3">
                {projects.map(project => {
                  const classBadge = getDeviceClassLabel(project.regulatoryProfile);
                  const jBadges = getJurisdictionBadge(project.jurisdiction);
                  // Placeholder completeness — replace with real data when available
                  const completeness = 42;

                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="block rounded-xl overflow-hidden glass-card-hover"
                      style={{ borderLeft: getDeviceClassBorder(project.regulatoryProfile) }}
                    >
                      <div className="flex items-center justify-between p-5">
                        <div className="flex-1 min-w-0">
                          {/* Name + badges row */}
                          <div className="flex items-center gap-3 flex-wrap mb-1.5">
                            <p className="font-semibold" style={{ color: 'var(--off-white)' }}>
                              {project.name}
                            </p>
                            {/* Device class badge */}
                            <span
                              className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: `${classBadge.color}20`, color: classBadge.color }}
                            >
                              {classBadge.label}
                            </span>
                            {/* Jurisdiction badges */}
                            {jBadges.map(b => (
                              <span
                                key={b.label}
                                className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: b.bg, color: b.color }}
                              >
                                {b.label}
                              </span>
                            ))}
                          </div>

                          {project.description && (
                            <p className="text-sm mb-3 opacity-40 truncate">{project.description}</p>
                          )}

                          {/* Progress bar + metadata */}
                          <div className="flex items-center gap-4">
                            {/* Documentation completeness */}
                            <div className="flex items-center gap-2 flex-1 max-w-48">
                              <div
                                className="flex-1 h-1 rounded-full overflow-hidden"
                                style={{ background: 'var(--border)' }}
                              >
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${completeness}%`,
                                    background: 'var(--teal)',
                                    boxShadow: '0 0 6px var(--teal)',
                                  }}
                                />
                              </div>
                              <span className="text-[10px] font-mono opacity-40 flex-shrink-0">
                                {completeness}% docs
                              </span>
                            </div>

                            <span
                              className="text-xs font-mono opacity-30 capitalize"
                            >
                              {project.deviceCategory.replace(/_/g, ' ')}
                            </span>

                            <span className="text-xs font-mono opacity-25">
                              {new Date(project.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>

                        <ChevronRight
                          className="h-4 w-4 flex-shrink-0 ml-4 opacity-20 group-hover:opacity-60 transition-opacity"
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
