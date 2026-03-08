'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Shield } from 'lucide-react';

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    deviceCategory: 'assistive_wearable',
    jurisdiction: 'fda_us',
    deviceName: '',
    intendedUse: '',
    deviceClass: 'II',
    manufacturerName: '',
    modelNumber: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          deviceCategory: form.deviceCategory,
          jurisdiction: form.jurisdiction,
          device: {
            name: form.deviceName,
            intendedUse: form.intendedUse,
            deviceClass: form.deviceClass,
            manufacturerName: form.manufacturerName,
            modelNumber: form.modelNumber,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to create project');
      }

      const data = await res.json();
      router.push(`/projects/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8" style={{ background: 'var(--background)' }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Shield className="h-6 w-6" style={{ color: 'var(--teal)' }} />
            <div>
              <p className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--teal)', opacity: 0.8 }}>
                maudie.ai
              </p>
              <h1 className="text-2xl" style={{ fontFamily: 'var(--font-instrument-serif)', color: 'var(--off-white)' }}>
                New Compliance Project
              </h1>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Section title="Project Information">
              <Field label="Project Name" required>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., ExoArm v2.0 — FDA 510(k) Submission"
                  required
                />
              </Field>
              <Field label="Description">
                <textarea
                  className="form-input min-h-[88px] resize-none"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g., Pre-submission regulatory package for the ExoArm powered upper-limb exoskeleton targeting Class II FDA clearance via 510(k) pathway."
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Device Category" required>
                  <select className="form-input" value={form.deviceCategory} onChange={e => setForm(f => ({ ...f, deviceCategory: e.target.value }))}>
                    <option value="assistive_wearable">Assistive / Wearable Robotics</option>
                    <option value="surgical" disabled>Surgical Robotics (coming soon)</option>
                    <option value="rehabilitation" disabled>Rehabilitation Robotics (coming soon)</option>
                  </select>
                </Field>
                <Field label="Jurisdiction" required>
                  <select className="form-input" value={form.jurisdiction} onChange={e => setForm(f => ({ ...f, jurisdiction: e.target.value }))}>
                    <option value="fda_us">FDA / United States</option>
                    <option value="ce_eu" disabled>CE / European Union (coming soon)</option>
                  </select>
                </Field>
              </div>
            </Section>

            <Section title="Device Information">
              <Field label="Device Name" required>
                <input
                  className="form-input"
                  value={form.deviceName}
                  onChange={e => setForm(f => ({ ...f, deviceName: e.target.value }))}
                  placeholder="e.g., ExoArm Powered Upper-Limb Exoskeleton"
                  required
                />
              </Field>
              <Field label="Intended Use">
                <textarea
                  className="form-input min-h-[88px] resize-none"
                  value={form.intendedUse}
                  onChange={e => setForm(f => ({ ...f, intendedUse: e.target.value }))}
                  placeholder="e.g., Intended to assist individuals with upper-limb weakness due to stroke, spinal cord injury, or neuromuscular conditions in performing activities of daily living. For use in home and clinical settings under physician supervision."
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Device Class">
                  <select className="form-input" value={form.deviceClass} onChange={e => setForm(f => ({ ...f, deviceClass: e.target.value }))}>
                    <option value="I">Class I — Low risk</option>
                    <option value="II">Class II — Moderate risk</option>
                    <option value="III">Class III — High risk</option>
                  </select>
                </Field>
                <Field label="Model Number">
                  <input
                    className="form-input"
                    value={form.modelNumber}
                    onChange={e => setForm(f => ({ ...f, modelNumber: e.target.value }))}
                    placeholder="e.g., EA-200-2024"
                  />
                </Field>
              </div>
              <Field label="Manufacturer Name">
                <input
                  className="form-input"
                  value={form.manufacturerName}
                  onChange={e => setForm(f => ({ ...f, manufacturerName: e.target.value }))}
                  placeholder="e.g., Nexus Robotics, Inc."
                />
              </Field>
            </Section>

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--red-flag)' }}>
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="btn-teal px-6 py-2 disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Create Project'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ border: '1px solid var(--border)', color: 'rgba(245,244,240,0.6)', background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-6" style={{ background: '#ffffff', border: '1px solid #d1d5db' }}>
      <h2 className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: '#374151' }}>{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>
        {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
      </label>
      {children}
    </div>
  );
}
