'use client';

/**
 * Shown only when a report is run against the cross-facility "All facilities" scope.
 * States the counting rule so an aggregate number is never read without its definition.
 *
 * Two different dedupe units are in play, and which one applies depends on whether the
 * report counts from the roster or from attendance headers:
 *
 *   Roster-based (Manpower Summary, Attendance Rate "eligible") — employees.employee_code
 *   is globally unique, so an employee belongs to exactly one facility. Counting distinct
 *   codes across facilities gives the same answer as counting them per facility and adding.
 *
 *   Header-based (Raw Table, Daily Summary, Dept Pivot) — rows are deduped to the latest
 *   record per (employee_code, date, facility, department, shift), so the unit is
 *   (facility, employee_code) per date. That only equals a global distinct count if no
 *   employee is marked under two facilities on the same date. Verified against production
 *   2026-08-18: zero such rows.
 */
const ROSTER_REPORTS = new Set(['manpower', 'rate']);

export default function ScopeNote({ reportType }: { reportType: string }) {
  const roster = ROSTER_REPORTS.has(reportType);

  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderLeft: '3px solid var(--accent)',
      borderRadius: 'var(--r)',
      padding: '10px 14px',
      fontFamily: 'var(--mono)',
      fontSize: 12,
      color: 'var(--text-2)',
      lineHeight: 1.6,
    }}>
      <strong style={{ color: 'var(--text)' }}>All facilities — WH1 + WH2 + NORTH combined.</strong>{' '}
      {roster ? (
        <>
          Headcount is <code>COUNT(DISTINCT employee_code)</code> across the whole roster.
          An employee code belongs to exactly one facility, so nobody is counted twice.
        </>
      ) : (
        <>
          Counts are <code>COUNT(DISTINCT employee_code)</code> with{' '}
          <strong>(facility, employee_code) per date</strong> as the unit. No employee is
          marked under two facilities on the same date, so no one is double-counted.
        </>
      )}{' '}
      The <code>North_Wh</code> ghost batch is excluded, as in every other scope.
    </div>
  );
}
