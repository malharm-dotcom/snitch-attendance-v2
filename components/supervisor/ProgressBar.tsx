'use client';

interface ProgressBarProps {
  present: number;
  total: number;
}

export default function ProgressBar({ present, total }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        flex: 1,
        height: 8,
        background: 'var(--border)',
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: pct === 100 ? 'var(--success)' : 'var(--accent)',
          borderRadius: 4,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
        {present}/{total} ({pct}%)
      </span>
    </div>
  );
}
