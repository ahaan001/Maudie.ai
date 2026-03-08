'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Shield, AlertTriangle, Play, RefreshCw } from 'lucide-react';

interface FailureCluster {
  id: string;
  clusterName: string;
  failureMode: string;
  description: string;
  eventCount: number;
  representativeEvents: string[];
}

interface Hazard {
  id: string;
  description: string;
  harm: string;
  severity: string;
  probability: string;
  riskLevel: string;
  aiGenerated: boolean;
  reviewedAt?: string;
}

export default function IntelligencePage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = useState('');
  const [clusters, setClusters] = useState<FailureCluster[]>([]);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState('');

  useEffect(() => {
    params.then(p => {
      setProjectId(p.id);
      fetchData(p.id);
    });
  }, [params]);

  async function fetchData(id: string) {
    const res = await fetch(`/api/projects/${id}/intelligence`);
    const data = await res.json();
    setClusters(data.clusters ?? []);
    setHazards(data.hazards ?? []);
  }

  async function runAnalysis() {
    setRunning(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/agents/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'regulatory_intelligence',
          params: { keywords: ['exoskeleton', 'orthosis', 'wearable', 'assistive', 'prosthetic'] },
        }),
      });
      const data = await res.json();
      setJobId(data.jobId ?? '');
      setTimeout(() => fetchData(projectId), 10000);
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar projectId={projectId} />
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Regulatory Intelligence</h1>
              <p className="text-gray-500 mt-1">FDA MAUDE adverse event analysis and risk inputs</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => fetchData(projectId)} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={runAnalysis}
                disabled={running}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                {running ? 'Running...' : 'Run MAUDE Analysis'}
              </button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
            <p className="text-xs text-amber-700">
              All AI-generated risk inputs require engineering review before use in a risk management file.
              Risk inputs are labeled accordingly and require explicit sign-off.
            </p>
          </div>

          {jobId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <p className="text-xs text-blue-700">Analysis queued (job: {jobId}). Requires MAUDE data to be ingested. Refresh in ~30 seconds.</p>
            </div>
          )}

          {/* Failure clusters */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Failure Clusters ({clusters.length})
            </h2>
            {clusters.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No failure clusters yet. Run MAUDE analysis after ingesting regulatory data.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {clusters.map(cluster => (
                  <div key={cluster.id} className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{cluster.clusterName}</h3>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{cluster.eventCount} events</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{cluster.description}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">{cluster.failureMode}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hazards */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              AI-Generated Hazards ({hazards.length})
            </h2>
            {hazards.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                {hazards.map(hazard => (
                  <div key={hazard.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                        hazard.riskLevel === 'high' || hazard.severity === 'critical' ? 'text-red-500' : 'text-amber-500'
                      }`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{hazard.description}</p>
                        {hazard.harm && <p className="text-xs text-gray-500 mt-1">Harm: {hazard.harm}</p>}
                        <div className="flex gap-2 mt-2">
                          {hazard.severity && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Severity: {hazard.severity}</span>}
                          {hazard.probability && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Probability: {hazard.probability}</span>}
                          {hazard.aiGenerated && !hazard.reviewedAt && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Needs Review</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
