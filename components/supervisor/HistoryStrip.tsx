'use client';

import { stripStatusInfo } from '@/lib/constants';

interface HistoryStripProps {
  /** 7 calendar days, oldest → newest, as YYYY-MM-DD (the 7 days before the selected date). */
  days: string[];
  /** Map of YYYY-MM-DD → full status label for this employee. Missing day = no record. */
  statuses: Record<string, string> | undefined;
  /** Subtle loading state while the strip data is still being fetched. */
  loading?: boolean;
}

/** "2026-06-28" → "28 Jun" for compact tooltips, with zero timezone shift. */
function shortDate(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[(m ?? 1) - 1] ?? ''}`;
}

export default function HistoryStrip({ days, statuses, loading }: HistoryStripProps) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 2 }}>
        7d
      </span>
      {days.map((day) => {
        const status = statuses?.[day];
        if (loading) {
          return (
            <span
              key={day}
              className="skeleton"
              style={{ width: 26, height: 18, borderRadius: 4, display: 'inline-block' }}
            />
          );
        }
        if (!status) {
          return (
            <span
              key={day}
              title={`${shortDate(day)} · No record`}
              style={{
                minWidth: 26,
                height: 18,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--mono)',
                fontSize: 10,
                borderRadius: 4,
                color: 'var(--text-3)',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
              }}
            >
              –
            </span>
          );
        }
        const { code, color, bg } = stripStatusInfo(status);
        return (
          <span
            key={day}
            title={`${shortDate(day)} · ${status}`}
            style={{
              minWidth: 26,
              height: 18,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 5px',
              fontFamily: 'var(--mono)',
              fontSize: 10,
              fontWeight: 600,
              borderRadius: 4,
              color,
              background: bg,
              cursor: 'help',
            }}
          >
            {code}
          </span>
        );
      })}
    </div>
  );
}
