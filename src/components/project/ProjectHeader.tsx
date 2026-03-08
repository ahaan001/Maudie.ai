import { ComplianceScoreRing } from '@/components/ui/ComplianceScoreRing';
import type { RegulatoryProfile } from '@/types/regulatory';

interface ProjectHeaderProps {
  name: string;
  description?: string | null;
  deviceName?: string | null;
  deviceClass?: string | null;
  jurisdiction: string;
  deviceCategory: string;
  healthPct: number;
  regulatoryProfile: RegulatoryProfile;
}

function DeviceClassBadge({ deviceClass }: { deviceClass: string | null }) {
  if (!deviceClass) return null;
  const cfg: Record<string, { color: string; bg: string }> = {
    I:   { color: 'var(--green-ok)', bg: 'var(--green-dim)' },
    II:  { color: 'var(--amber)',    bg: 'var(--amber-dim)' },
    III: { color: 'var(--red-flag)', bg: 'var(--red-dim)' },
  };
  const c = cfg[deviceClass] ?? { color: 'var(--off-white)', bg: 'var(--surface-2)' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
      style={{ color: c.color, background: c.bg }}
    >
      Class {deviceClass}
    </span>
  );
}

function JurisdictionBadge({ jurisdiction }: { jurisdiction: string }) {
  const label = jurisdiction === 'fda_us' ? 'FDA / US' : jurisdiction === 'ce_mdr' ? 'CE / EU' : jurisdiction.toUpperCase();
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ color: 'rgba(245,244,240,0.6)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      {label}
    </span>
  );
}


export function ProjectHeader({
  name,
  description,
  deviceName,
  deviceClass,
  jurisdiction,
  deviceCategory,
  healthPct,
  regulatoryProfile,
}: ProjectHeaderProps) {
  return (
    <div className="mb-6">
      {/* Top row */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--off-white)', fontFamily: 'var(--font-sans)' }}>
              {deviceName ?? name}
            </h1>
            <DeviceClassBadge deviceClass={deviceClass ?? regulatoryProfile.device_class_default} />
            <JurisdictionBadge jurisdiction={jurisdiction} />
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-1">
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: 'var(--teal-dim)', color: 'var(--teal)' }}
            >
              {deviceCategory.replace(/_/g, ' ')}
            </span>
            {description && (
              <span className="text-xs" style={{ color: 'rgba(245,244,240,0.45)' }}>
                {description}
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 mt-1">
          <ComplianceScoreRing score={healthPct} size={64} />
        </div>
      </div>
    </div>
  );
}
