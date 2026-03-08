'use client';

import { useEffect, useRef } from 'react';

interface ComplianceScoreRingProps {
  score: number; // 0-100
  size?: number;
}

export function ComplianceScoreRing({ score, size = 96 }: ComplianceScoreRingProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;

    // Animate from 0 to target offset
    el.style.strokeDashoffset = String(circumference);
    el.style.transition = 'none';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
        el.style.strokeDashoffset = String(strokeDashoffset);
      });
    });
  }, [score, circumference, strokeDashoffset]);

  const getColor = (s: number) => {
    if (s >= 80) return 'var(--teal)';
    if (s >= 50) return 'var(--amber)';
    return 'var(--red-flag)';
  };

  const color = getColor(score);

  return (
    <div className="flex flex-col items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox="0 0 96 96"
        fill="none"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="7"
          fill="none"
        />
        {/* Progress */}
        <circle
          ref={circleRef}
          cx="48"
          cy="48"
          r={radius}
          stroke={color}
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          style={{
            filter: `drop-shadow(0 0 6px ${color}80)`,
          }}
        />
      </svg>

      {/* Center label */}
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span
          className="text-xl font-mono font-semibold leading-none"
          style={{ color }}
        >
          {score}
        </span>
        <span className="text-[10px] opacity-50 mt-0.5 font-mono tracking-wider uppercase">
          score
        </span>
      </div>
    </div>
  );
}

export function ComplianceScoreCard({ score }: { score: number }) {
  return (
    <div className="glass-card rounded-xl p-6 flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium opacity-60">Compliance Score</span>
      </div>
      <div className="relative flex items-center justify-center flex-1 mt-2">
        <ComplianceScoreRing score={score} size={96} />
      </div>
      <p className="text-xs text-center mt-3 opacity-40">
        {score >= 80
          ? 'On track for submission'
          : score >= 50
          ? 'Gaps require attention'
          : 'Critical gaps detected'}
      </p>
    </div>
  );
}
