'use client';

import { stripStatusInfo, ATTENDANCE_STATUSES } from '@/lib/constants';

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
  /** Per-date latest rewrite request status for this employee (pending/approved/rejected/used). */
  requestStatuses?: Record<string, string>;
  /** When true, past cells are clickable to raise an edit request / edit approved cells. */
  interactive?: boolean;
  /** Open the "request edit" confirm for one past cell (its own exact date). */
  onRequestCell?: (date: string, currentStatus: string) => void;
  /** Write a new status for an APPROVED cell — routes through the existing submit path. */
  onWriteCell?: (date: string, newStatus: string) => void;
  /** Date (YYYY-MM-DD) currently being saved inline — that cell shows a saving state. */
  savingDate?: string | null;
}

/** Human-readable suffix appended to a cell tooltip based on its rewrite-request state. */
function reqTooltip(reqStatus: string | undefined): string {
  switch (reqStatus) {
    case 'pending':  return ' · Edit requested (pending)';
    case 'approved': return ' · Edit approved — pick a new status';
    case 'rejected': return ' · Edit request rejected';
    case 'used':     return ' · Edited';
    default:         return '';
  }
}

export default function HistoryStrip({
  days, statuses, loading, requestStatuses, interactive, onRequestCell, onWriteCell, savingDate,
}: HistoryStripProps) {
  return (
    <div style={{ display: 'flex', gap: CELL_GAP, alignItems: 'center' }}>
      {days.map((day) => {
        const status = statuses?.[day.date];
        const reqStatus = requestStatuses?.[day.date];

        if (loading) {
          return (
            <span
              key={day.date}
              className="skeleton"
              style={{ width: CELL_W, height: 18, borderRadius: 4, flexShrink: 0, display: 'inline-block' }}
            />
          );
        }

        // APPROVED → inline editable dropdown for this specific date.
        if (interactive && onWriteCell && reqStatus === 'approved') {
          const saving = savingDate === day.date;
          const selectValue = status && ATTENDANCE_STATUSES.includes(status) ? status : 'Present';
          return (
            <select
              key={day.date}
              value={selectValue}
              disabled={saving}
              title={`Set status · ${ddmmyyyy(day.date)}`}
              onChange={(e) => onWriteCell(day.date, e.target.value)}
              style={{
                width: CELL_W,
                height: 18,
                flexShrink: 0,
                fontFamily: 'var(--mono)',
                fontSize: 9,
                fontWeight: 600,
                borderRadius: 4,
                border: '1.5px solid var(--success)',
                background: saving ? 'var(--surface2)' : 'var(--success-bg)',
                color: 'var(--success)',
                padding: '0 2px',
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {ATTENDANCE_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          );
        }

        // Clickable to raise an edit request when interactive and not already pending/approved.
        const canRequest = !!(interactive && onRequestCell && reqStatus !== 'pending');
        const pendingRing = reqStatus === 'pending';
        const tooltip = `${status ? status : 'No record'} · ${ddmmyyyy(day.date)}${reqTooltip(reqStatus)}`;

        const base: React.CSSProperties = {
          width: CELL_W,
          height: 18,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--mono)',
          fontSize: 10,
          borderRadius: 4,
          cursor: canRequest ? 'pointer' : (pendingRing ? 'default' : 'help'),
          boxShadow: pendingRing ? 'inset 0 0 0 1.5px var(--warn)' : undefined,
        };

        if (!status) {
          return (
            <span
              key={day.date}
              title={tooltip}
              onClick={canRequest ? () => onRequestCell!(day.date, '') : undefined}
              style={{ ...base, color: 'var(--text-3)', background: 'var(--surface2)', border: pendingRing ? undefined : '1px solid var(--border)' }}
            >
              –
            </span>
          );
        }

        const { code, color, bg } = stripStatusInfo(status);
        return (
          <span
            key={day.date}
            title={tooltip}
            onClick={canRequest ? () => onRequestCell!(day.date, status) : undefined}
            style={{ ...base, fontWeight: 600, color, background: bg }}
          >
            {code}
          </span>
        );
      })}
    </div>
  );
}
