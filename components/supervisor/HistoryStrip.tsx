'use client';

import { stripStatusInfo } from '@/lib/constants';

/** Shared column geometry — header and every employee's cells MUST use these identical values
 *  so a status code always sits directly under its date column (spreadsheet alignment). */
export const CELL_W = 46;
export const CELL_GAP = 4;
/** Left inset matching an EmployeeRow card's content edge (1px border + 14px padding). */
export const STRIP_LEFT_INSET = 15;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface DayColumn {
  date: string;      // YYYY-MM-DD (the exact key used against the history-strip API map)
  ddmmm: string;     // "29-May"
  weekday: string;   // "Fri"
  isWeekend: boolean; // Sat/Sun get a subtle header tint
}

/**
 * The 7 calendar days ending the day BEFORE the selected date, oldest → newest.
 * Plain YYYY-MM-DD math on UTC midnight — zero timezone shift.
 * Single source of column order shared by the header and every employee row.
 */
export function buildDayColumns(selectedDate: string): DayColumn[] {
  const [y, m, d] = selectedDate.split('-').map(Number);
  const sel = Date.UTC(y, m - 1, d);
  const out: DayColumn[] = [];
  for (let i = 7; i >= 1; i--) {
    const dt = new Date(sel - i * 86400000);
    const yy = dt.getUTCFullYear();
    const mm = dt.getUTCMonth();
    const dd = dt.getUTCDate();
    const dow = dt.getUTCDay();
    out.push({
      date: `${yy}-${String(mm + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`,
      ddmmm: `${String(dd).padStart(2, '0')}-${MONTHS[mm]}`,
      weekday: WEEKDAYS[dow],
      isWeekend: dow === 0 || dow === 6,
    });
  }
  return out;
}

/** "2026-05-29" → "29-05-2026" for tooltips. */
function ddmmyyyy(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}-${m}-${y}`;
}

/* ------------------------------------------------------------------ */
/* Sticky date header — rendered ONCE above the employee list.         */
/* ------------------------------------------------------------------ */

interface HistoryStripHeaderProps {
  days: DayColumn[];
}

export function HistoryStripHeader({ days }: HistoryStripHeaderProps) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 52, // sit just below the sticky Topbar (height 52)
        zIndex: 20,
        display: 'flex',
        alignItems: 'flex-end',
        gap: CELL_GAP,
        paddingLeft: STRIP_LEFT_INSET,
        paddingTop: 6,
        paddingBottom: 6,
        background: 'var(--surface2)',
        borderBottom: '1.5px solid var(--border)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
      }}
    >
      {days.map((day) => (
        <div
          key={day.date}
          style={{
            width: CELL_W,
            flexShrink: 0,
            textAlign: 'center',
            padding: '3px 0',
            borderRadius: 5,
            background: day.isWeekend ? 'rgba(99,102,241,0.09)' : 'transparent',
          }}
        >
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, color: 'var(--text-2)', lineHeight: 1.25 }}>
            {day.ddmmm}
          </div>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 9,
              color: day.isWeekend ? 'var(--accent)' : 'var(--text-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              lineHeight: 1.25,
            }}
          >
            {day.weekday}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Per-employee cells — one row of 7 aligned status codes.             */
/* ------------------------------------------------------------------ */

interface HistoryStripProps {
  /** Shared day columns (oldest → newest) — identical instance used by the header. */
  days: DayColumn[];
  /** Map of YYYY-MM-DD → full status label for this employee. Missing day = no record. */
  statuses: Record<string, string> | undefined;
  /** Subtle loading state while the strip data is still being fetched. */
  loading?: boolean;
}

export default function HistoryStrip({ days, statuses, loading }: HistoryStripProps) {
  return (
    <div style={{ display: 'flex', gap: CELL_GAP, alignItems: 'center' }}>
      {days.map((day) => {
        const status = statuses?.[day.date];

        if (loading) {
          return (
            <span
              key={day.date}
              className="skeleton"
              style={{ width: CELL_W, height: 18, borderRadius: 4, flexShrink: 0, display: 'inline-block' }}
            />
          );
        }

        if (!status) {
          return (
            <span
              key={day.date}
              title={`No record · ${ddmmyyyy(day.date)}`}
              style={{
                width: CELL_W,
                height: 18,
                flexShrink: 0,
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
            key={day.date}
            title={`${status} · ${ddmmyyyy(day.date)}`}
            style={{
              width: CELL_W,
              height: 18,
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
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
