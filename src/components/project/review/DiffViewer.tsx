'use client';

import { computeLineDiff } from '@/lib/diff';

interface DiffViewerProps {
  original: string;
  modified: string;
}

export function DiffViewer({ original, modified }: DiffViewerProps) {
  const lines = computeLineDiff(original, modified);

  return (
    <div
      className="rounded-lg overflow-auto text-xs font-mono max-h-64"
      style={{ background: 'var(--navy-800)', border: '1px solid var(--border)' }}
    >
      {lines.map((line, i) => {
        const bg =
          line.type === 'added'
            ? 'var(--green-dim)'
            : line.type === 'removed'
            ? 'var(--red-dim)'
            : 'transparent';
        const color =
          line.type === 'added'
            ? 'var(--green-ok)'
            : line.type === 'removed'
            ? 'var(--red-flag)'
            : 'rgba(245,244,240,0.6)';
        const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';

        return (
          <div
            key={i}
            className="flex px-3 py-0.5"
            style={{ background: bg, color }}
          >
            <span className="w-4 flex-shrink-0 opacity-60">{prefix}</span>
            <span className="whitespace-pre-wrap break-all">{line.line || ' '}</span>
          </div>
        );
      })}
    </div>
  );
}
