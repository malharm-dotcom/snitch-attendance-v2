/**
 * Employee View consolidated summary — pure counting, no React.
 *
 * Lives in lib/ (not in the component) so scripts/verify-employee-summary.ts can run the
 * SAME code against production rows. Nothing here touches Attendance Rate or Dept Pivot:
 * those use lib/reporting.ts buckets and are deliberately separate code paths.
 *
 * Every entry maps a column to VERBATIM attendance_status strings, enumerated from
 * production attendance_detail on 2026-09-03 (18 distinct values). attendance_status is
 * PLAIN TEXT — nothing here may be inferred from a label.
 */

export const SUMMARY_BUCKETS = [
  { key: 'P',   label: 'P',   statuses: ['Present'] },
  { key: 'WO',  label: 'WO',  statuses: ['Week Off'] },
  { key: 'SL',  label: 'SL',  statuses: ['Sick Leave'] },
  { key: 'PL',  label: 'PL',  statuses: ['Paid Leave'] },
  { key: 'BL',  label: 'BL',  statuses: ['Bereavement Leave'] },
  { key: 'HD',  label: 'H/D', statuses: ['Half Day'] },
  { key: 'H',   label: 'H',   statuses: ['Holiday'] },
  { key: 'WOW', label: 'WOW', statuses: ['Work on Week Off'] },
  { key: 'CO',  label: 'C/O', statuses: ['Compensatory Off'] },
  { key: 'UL',  label: 'UL',  statuses: ['Unpaid Leave'] },
  // Not in the requested column list, but "LOP" is a real status (3113 rows) and feeds
  // Final LOP — without a column of its own those days break the row-sum invariant.
  { key: 'LOP', label: 'LOP', statuses: ['LOP'] },
  { key: 'A',   label: 'A',   statuses: ['Absent', 'Absconding'] },
] as const;

export type BucketKey = (typeof SUMMARY_BUCKETS)[number]['key'];

/**
 * status string -> column key. Anything absent is an "Oth" day rather than being
 * silently dropped, which is what keeps sum(P..NA) === Total Days true by construction.
 * Currently landing in Oth: "Planned Leave", "Unplanned Leave", "Work On Holiday",
 * "Maternity Leave", "Paternity Leave" — awaiting sign-off on their columns.
 */
export const STATUS_TO_BUCKET: Record<string, BucketKey> = Object.fromEntries(
  SUMMARY_BUCKETS.flatMap((b) => b.statuses.map((s) => [s, b.key as BucketKey])),
);

export interface EmployeeSummary {
  counts: Record<string, number>;
  oth: number;
  na: number;
  totalDays: number;
  actualPresent: number;
  actualWeekOff: number;
  finalLop: number;
}

/**
 * Every calendar day in [fromDate, toDate], inclusive — NOT just days that have a
 * record, which is what NA has to be counted against. Plain YYYY-MM-DD: the arithmetic
 * is UTC-only, so no day ever shifts.
 */
export function calendarRange(fromDate: string, toDate: string): string[] {
  const out: string[] = [];
  const end = Date.parse(toDate + 'T00:00:00Z');
  for (let t = Date.parse(fromDate + 'T00:00:00Z'); t <= end; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Whole numbers stay whole; Half Day makes Actual Present land on .5. */
export function fmtCount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export interface SummaryInput {
  /** YYYY-MM-DD -> attendance_status. At most ONE entry per date (DISTINCT-safe). */
  statusByDate: Map<string, string> | undefined;
  /** '' when unknown. A NULL joining_date opens the window at fromDate. */
  joiningDate: string;
  /** '' when still employed. */
  exitDate: string;
}

/**
 * Per-employee consolidated summary over the selected range.
 *
 * Counts are DISTINCT-safe per (employee_code, date) by construction: statusByDate holds
 * at most one status per day (the API already dedups to rn = 1, and a Map keyed by date
 * collapses anything left).
 */
export function summarizeEmployee(
  emp: SummaryInput,
  rangeDates: string[],
  fromDate: string,
  toDate: string,
): EmployeeSummary {
  const counts: Record<string, number> = {};
  for (const b of SUMMARY_BUCKETS) counts[b.key] = 0;
  let oth = 0;
  let na = 0;

  // Employment window, clamped to the range. A NULL joining_date means "no known start",
  // so the window opens at From rather than dropping the employee (1020 of 1041 rows).
  // String comparison is correct and tz-free for YYYY-MM-DD.
  const winStart = emp.joiningDate && emp.joiningDate > fromDate ? emp.joiningDate : fromDate;
  const winEnd = emp.exitDate && emp.exitDate < toDate ? emp.exitDate : toDate;

  for (const d of rangeDates) {
    const status = (emp.statusByDate?.get(d) ?? '').trim();
    if (!status) {
      // No record. Only counts as NA inside the employment window — pre-joining and
      // post-exit blanks must not inflate it.
      if (d >= winStart && d <= winEnd) na++;
      continue;
    }
    const bucket = STATUS_TO_BUCKET[status];
    if (bucket) counts[bucket]++;
    else oth++;
  }

  return {
    counts,
    oth,
    na,
    totalDays: rangeDates.length,
    actualPresent: counts.P + counts.WOW + 0.5 * counts.HD,
    actualWeekOff: counts.WO + counts.CO,
    // v1: NA is review-only and deliberately NOT auto-counted as LOP.
    // To make unmarked-within-employment days count as LOP, add `+ na` here.
    finalLop: counts.LOP + counts.UL + counts.A,
  };
}
