'use client';

interface ShiftToggleProps {
  shift: 'Day' | 'Night';
  onChange: (shift: 'Day' | 'Night') => void;
}

export default function ShiftToggle({ shift, onChange }: ShiftToggleProps) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {(['Day', 'Night'] as const).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          style={{
            padding: '6px 16px',
            border: 'none',
            borderRadius: 20,
            fontFamily: 'var(--mono)',
            fontSize: 12,
            cursor: 'pointer',
            background: shift === s ? 'var(--text)' : 'var(--surface2)',
            color: shift === s ? '#fff' : 'var(--text-2)',
            transition: 'all 0.15s',
          }}
        >
          {s === 'Day' ? '☀ Day' : '🌙 Night'}
        </button>
      ))}
    </div>
  );
}
