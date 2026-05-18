'use client';

import { STATUS_CLASSES } from '@/lib/constants';

interface SummaryBarProps {
  counts: Record<string, number>;
}

export default function SummaryBar({ counts }: SummaryBarProps) {
  const entries = Object.entries(counts).filter(([, v]) => v > 0);
  if (entries.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {entries.map(([status, count]) => {
        const cls = STATUS_CLASSES[status] ?? 'present';
        return (
          <span
            key={status}
            className={`chip-${cls}`}
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 20,
              fontWeight: 500,
            }}
          >
            {status}: {count}
          </span>
        );
      })}
    </div>
  );
}
