'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { PageMotion } from '@/components/ui/PageMotion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from 'recharts';
import {
  FolderOpen,
  CheckCircle,
  Clock,
  FileText,
  Zap,
  TrendingUp,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OverviewData {
  total_projects: number;
  total_documents: number;
  total_drafts_generated: number;
  total_approved_drafts: number;
  total_pending_reviews: number;
  avg_compliance_score: number;
  total_agent_tokens_used: number;
  avg_draft_generation_time_ms: number;
  project_scores: { projectId: string; name: string; score: number }[];
}

interface TimelinePoint {
  week: string;
  count: number;
}

interface AgentRow {
  agentName: string;
  totalRuns: number;
  avgDurationMs: number;
  successRate: number;
  avgConfidenceScore: number | null;
}

interface ReviewMetrics {
  avg_time_to_approval_ms: number | null;
  approval_rate: number;
  escalation_rate: number;
  auto_approval_rate: number;
  reviews_by_risk_level: { low: number; medium: number; high: number };
  funnel: { name: string; value: number }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type DateRange = '7' | '30' | '90' | 'all';

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--teal)';
  if (score >= 50) return 'var(--amber)';
  return 'var(--red-flag)';
}

function fmtMs(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${ms}ms`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function weekLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

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
      <div className="inline-flex p-2 rounded-lg mb-4" style={{ background: accentDim }}>
        <Icon className="h-4 w-4" style={{ color: accentColor }} />
      </div>
      <p className="text-2xl font-mono font-semibold" style={{ color: accentColor }}>
        {value}
      </p>
      <p className="text-xs mt-1.5 opacity-50">{label}</p>
    </div>
  );
}

// ─── Date Range Filter ────────────────────────────────────────────────────────

const DATE_RANGES: { label: string; value: DateRange }[] = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
  { label: 'All time', value: 'all' },
];

function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
}) {
  return (
    <div className="flex gap-1">
      {DATE_RANGES.map(r => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: value === r.value ? 'var(--teal-dim)' : 'var(--surface-2)',
            color: value === r.value ? 'var(--teal)' : 'rgba(245,244,240,0.5)',
            border: value === r.value ? '1px solid rgba(0,181,173,0.3)' : '1px solid var(--border)',
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

// ─── Chart Section Card ───────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-xl p-6">
      <h3
        className="text-base mb-5"
        style={{ fontFamily: 'var(--font-instrument-serif)', color: 'var(--off-white)' }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('30');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [reviewMetrics, setReviewMetrics] = useState<ReviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async (range: DateRange) => {
    setLoading(true);
    const qs = range === 'all' ? '' : `?days=${range}`;
    const safeJson = async (url: string) => {
      const r = await fetch(url);
      if (!r.ok) return null;
      return r.json();
    };
    try {
      const [ov, tl, ap, rv] = await Promise.all([
        safeJson(`/api/analytics/overview${qs}`),
        safeJson(`/api/analytics/projects-timeline${qs}`),
        safeJson(`/api/analytics/agent-performance${qs}`),
        safeJson(`/api/analytics/review-metrics${qs}`),
      ]);
      setOverview(ov);
      setTimeline(tl?.timeline ?? []);
      setAgents(ap?.agents ?? []);
      setReviewMetrics(rv);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll(dateRange);
  }, [dateRange, fetchAll]);

  const avgScore = overview?.avg_compliance_score ?? 0;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-8">
          <PageMotion>
            <div className="max-w-6xl mx-auto">

              {/* Header */}
              <div className="flex items-end justify-between mb-8">
                <div>
                  <p
                    className="text-xs font-mono uppercase tracking-widest mb-2"
                    style={{ color: 'var(--teal)', opacity: 0.8 }}
                  >
                    maudie.ai
                  </p>
                  <h1 className="text-3xl" style={{ fontFamily: 'var(--font-instrument-serif)' }}>
                    Analytics
                  </h1>
                </div>
                <DateRangeFilter value={dateRange} onChange={setDateRange} />
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                <StatCard
                  icon={FolderOpen}
                  label="Total Projects"
                  value={loading ? '—' : String(overview?.total_projects ?? 0)}
                  accentColor="var(--teal)"
                  accentDim="var(--teal-dim)"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Avg Compliance"
                  value={loading ? '—' : `${avgScore}%`}
                  accentColor={scoreColor(avgScore)}
                  accentDim={avgScore >= 80 ? 'var(--teal-dim)' : avgScore >= 50 ? 'var(--amber-dim)' : 'var(--red-dim)'}
                />
                <StatCard
                  icon={CheckCircle}
                  label="Drafts Approved"
                  value={loading ? '—' : String(overview?.total_approved_drafts ?? 0)}
                  accentColor="var(--green-ok)"
                  accentDim="var(--green-dim)"
                />
                <StatCard
                  icon={Clock}
                  label="Pending Reviews"
                  value={loading ? '—' : String(overview?.total_pending_reviews ?? 0)}
                  accentColor="var(--amber)"
                  accentDim="var(--amber-dim)"
                />
                <StatCard
                  icon={FileText}
                  label="Docs Ingested"
                  value={loading ? '—' : String(overview?.total_documents ?? 0)}
                  accentColor="var(--teal)"
                  accentDim="var(--teal-dim)"
                />
                <StatCard
                  icon={Zap}
                  label="Avg Generation Time"
                  value={
                    loading
                      ? '—'
                      : overview?.avg_draft_generation_time_ms
                      ? fmtMs(overview.avg_draft_generation_time_ms)
                      : '—'
                  }
                  accentColor="var(--amber)"
                  accentDim="var(--amber-dim)"
                />
              </div>

              {/* Charts row: Compliance + Funnel */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                {/* Project Compliance Scores */}
                <ChartCard title="Project Compliance Scores">
                  {loading || !overview?.project_scores?.length ? (
                    <div
                      className="flex items-center justify-center h-48 text-sm opacity-40"
                      style={{ color: 'var(--off-white)' }}
                    >
                      {loading ? 'Loading…' : 'No project data'}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(180, overview.project_scores.length * 40)}>
                      <BarChart
                        layout="vertical"
                        data={overview.project_scores}
                        margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,244,240,0.06)" horizontal={false} />
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          tickFormatter={v => `${v}%`}
                          tick={{ fill: 'rgba(245,244,240,0.4)', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={120}
                          tick={{ fill: 'rgba(245,244,240,0.6)', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(v) => [`${v}%`, 'Compliance Score']}
                          contentStyle={{
                            background: 'var(--navy)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            color: 'var(--off-white)',
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={18}>
                          {overview.project_scores.map((entry, i) => (
                            <Cell key={i} fill={scoreColor(entry.score)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                {/* Review Funnel */}
                <ChartCard title="Review Funnel">
                  {loading || !reviewMetrics ? (
                    <div
                      className="flex items-center justify-center h-48 text-sm opacity-40"
                      style={{ color: 'var(--off-white)' }}
                    >
                      {loading ? 'Loading…' : 'No review data'}
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart
                          data={reviewMetrics.funnel}
                          margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,244,240,0.06)" vertical={false} />
                          <XAxis
                            dataKey="name"
                            tick={{ fill: 'rgba(245,244,240,0.45)', fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fill: 'rgba(245,244,240,0.4)', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              background: 'var(--navy)',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              color: 'var(--off-white)',
                              fontSize: 12,
                            }}
                          />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}>
                            {reviewMetrics.funnel.map((_, i) => {
                              const colors = [
                                'var(--teal)',
                                'rgba(0,181,173,0.7)',
                                'var(--amber)',
                                'var(--green-ok)',
                                'var(--red-flag)',
                              ];
                              return <Cell key={i} fill={colors[i] ?? 'var(--teal)'} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>

                      {/* Review rate pills */}
                      <div className="flex gap-3 mt-4 flex-wrap">
                        <RatePill label="Approval Rate" value={`${reviewMetrics.approval_rate}%`} color="var(--green-ok)" dim="var(--green-dim)" />
                        <RatePill label="Auto-Approved" value={`${reviewMetrics.auto_approval_rate}%`} color="var(--teal)" dim="var(--teal-dim)" />
                        <RatePill label="Escalation Rate" value={`${reviewMetrics.escalation_rate}%`} color="var(--amber)" dim="var(--amber-dim)" />
                      </div>
                    </>
                  )}
                </ChartCard>
              </div>

              {/* Timeline */}
              <div className="mb-6">
                <ChartCard title="Draft Generation Volume (weekly)">
                  {loading || timeline.length === 0 ? (
                    <div
                      className="flex items-center justify-center h-48 text-sm opacity-40"
                      style={{ color: 'var(--off-white)' }}
                    >
                      {loading ? 'Loading…' : 'No timeline data'}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart
                        data={timeline.map(p => ({ ...p, week: weekLabel(p.week) }))}
                        margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,244,240,0.06)" />
                        <XAxis
                          dataKey="week"
                          tick={{ fill: 'rgba(245,244,240,0.4)', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: 'rgba(245,244,240,0.4)', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--navy)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            color: 'var(--off-white)',
                            fontSize: 12,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="var(--teal)"
                          strokeWidth={2}
                          dot={{ fill: 'var(--teal)', r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </div>

              {/* Agent Performance Table */}
              <ChartCard title="Agent Performance">
                {loading || agents.length === 0 ? (
                  <div
                    className="flex items-center justify-center h-24 text-sm opacity-40"
                    style={{ color: 'var(--off-white)' }}
                  >
                    {loading ? 'Loading…' : 'No agent runs in this period'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Agent', 'Runs', 'Avg Duration', 'Success Rate', 'Avg Confidence'].map(h => (
                            <th
                              key={h}
                              className="text-left py-2 pr-6 text-xs font-semibold uppercase tracking-wide"
                              style={{ color: 'rgba(245,244,240,0.35)' }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {agents.map(a => (
                          <tr
                            key={a.agentName}
                            style={{ borderBottom: '1px solid rgba(245,244,240,0.05)' }}
                          >
                            <td className="py-3 pr-6 font-mono text-xs" style={{ color: 'var(--teal)' }}>
                              {a.agentName}
                            </td>
                            <td className="py-3 pr-6" style={{ color: 'var(--off-white)' }}>
                              {a.totalRuns}
                            </td>
                            <td className="py-3 pr-6 font-mono" style={{ color: 'var(--off-white)' }}>
                              {fmtMs(a.avgDurationMs)}
                            </td>
                            <td className="py-3 pr-6">
                              <span
                                className="font-mono font-semibold"
                                style={{
                                  color: a.successRate >= 90 ? 'var(--green-ok)' : a.successRate >= 70 ? 'var(--amber)' : 'var(--red-flag)',
                                }}
                              >
                                {a.successRate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-3" style={{ color: 'rgba(245,244,240,0.5)' }}>
                              {a.avgConfidenceScore != null ? a.avgConfidenceScore.toFixed(2) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Token usage footer */}
                {overview && (
                  <div
                    className="mt-5 pt-4 flex items-center gap-2 text-xs"
                    style={{ borderTop: '1px solid var(--border)', color: 'rgba(245,244,240,0.4)' }}
                  >
                    <Zap className="h-3.5 w-3.5" style={{ color: 'var(--amber)' }} />
                    <span>
                      <strong style={{ color: 'var(--amber)' }}>{fmtTokens(overview.total_agent_tokens_used)}</strong>
                      {' '}total tokens used across all agents
                    </span>
                  </div>
                )}
              </ChartCard>

            </div>
          </PageMotion>
        </main>
      </div>
    </div>
  );
}

function RatePill({ label, value, color, dim }: { label: string; value: string; color: string; dim: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
      style={{ background: dim, border: `1px solid ${color}22` }}
    >
      <span style={{ color: 'rgba(245,244,240,0.5)' }}>{label}</span>
      <span className="font-mono font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}
