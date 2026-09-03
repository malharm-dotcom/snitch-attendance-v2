'use client';

import { useMemo, useState } from 'react';
import { MATRIX_CHIP_LABELS } from '@/lib/constants';
import { normalizeRollType, normalizeShift } from '@/lib/reporting';
import { SUMMARY_BUCKETS, STATUS_TO_BUCKET, calendarRange, summarizeEmployee, fmtCount } from '@/lib/attendanceSummary';
import type { HistoryRecord } from '@/lib/types';

interface HistoryMatrixProps {
  records: HistoryRecord[];
  searchQuery: string;
  statusFilter: string;
  /** '' = no filter. Compared against the NORMALIZED roster value, not the raw column. */
  rollTypeFilter?: string;
  shiftFilter?: string;
  /** '' = no filter. Display-only narrowing INSIDE the session's server-derived scope. */
  facilityFilter?: string;
  fromDate?: string;
  toDate?: string;
  showSummary?: boolean;
  showPayrollDates?: boolean;  // true only in Employee View (ManagerMatrix); false in supervisor History
}

interface TooltipState {
  x: number;
  y: number;
  status: string;
  remarks: string | null;
  employee: string;
  date: string;
}

/** Column accent colours — presence green, absence red, everything else neutral. */
const SUMMARY_HEAD_COLOR: Record<string, string> = {
  P: 'var(--success)', WOW: 'var(--success)',
  A: 'var(--danger)', UL: 'var(--danger)', LOP: 'var(--danger)',
};

function fmtDDMMYYYY(s: string | undefined): string {
  if (!s) return '';
  const parts = s.split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

export default function HistoryMatrix({
  records,
  searchQuery,
  statusFilter,
  rollTypeFilter = '',
  shiftFilter = '',
  facilityFilter = '',
  fromDate,
  toDate,
  showSummary = false,
  showPayrollDates = false,
}: HistoryMatrixProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { employees, dates, matrix } = useMemo(() => {
    const dateSet = new Set<string>();
    const empMap = new Map<string, { code: string; name: string; joiningDate: string; exitDate: string; department: string; reportingManager: string; shift: string; rollType: string; facility: string }>();

    for (const r of records) {
      if (!r.ATTENDANCE_DATE) continue;
      const dateStr = String(r.ATTENDANCE_DATE).slice(0, 10);
      dateSet.add(dateStr);
      // First record per employee wins for the static payroll dates
      if (!empMap.has(r.EMPLOYEE_CODE)) {
        empMap.set(r.EMPLOYEE_CODE, {
          code: r.EMPLOYEE_CODE,
          name: r.EMPLOYEE_NAME,
          joiningDate: r.JOINING_DATE ?? '',
          exitDate: r.EXIT_DATE ?? '',
          department: r.DEPARTMENT ?? '',
          reportingManager: r.REPORTING_MANAGER ?? '',
          shift: r.SHIFT ?? '',
          rollType: r.ROLL_TYPE ?? '',
          facility: r.FACILITY ?? '',
        });
      }
    }

    const dates = Array.from(dateSet).sort();
    const employees = Array.from(empMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    const mat = new Map<string, Map<string, HistoryRecord>>();
    for (const r of records) {
      if (!r.ATTENDANCE_DATE) continue;
      const dateStr = String(r.ATTENDANCE_DATE).slice(0, 10);
      if (!mat.has(r.EMPLOYEE_CODE)) mat.set(r.EMPLOYEE_CODE, new Map());
      mat.get(r.EMPLOYEE_CODE)!.set(dateStr, r);
    }

    return { employees, dates, matrix: mat };
  }, [records]);

  /** Every calendar day in the range — NOT just days with a record, which is what NA needs. */
  const rangeDates = useMemo(
    () => (showSummary && fromDate && toDate ? calendarRange(fromDate, toDate) : []),
    [showSummary, fromDate, toDate],
  );

  const totalDays = rangeDates.length;

  /** Columns to render: a status bucket appears only if one of its statuses is in the data. */
  const visibleBuckets = useMemo(() => {
    const present = new Set(records.map((r) => (r.ATTENDANCE_STATUS ?? '').trim()));
    return SUMMARY_BUCKETS.filter((b) => b.statuses.some((s) => present.has(s)));
  }, [records]);

  const hasOther = useMemo(
    () => records.some((r) => {
      const s = (r.ATTENDANCE_STATUS ?? '').trim();
      return s !== '' && !STATUS_TO_BUCKET[s];
    }),
    [records],
  );

  function getSummary(emp: { code: string; joiningDate: string; exitDate: string }) {
    const days = matrix.get(emp.code);
    const statusByDate = days && new Map(Array.from(days, ([d, r]) => [d, r.ATTENDANCE_STATUS]));
    return summarizeEmployee(
      { statusByDate, joiningDate: emp.joiningDate, exitDate: emp.exitDate },
      rangeDates,
      fromDate ?? '',
      toDate ?? '',
    );
  }

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (rollTypeFilter && normalizeRollType(e.rollType) !== rollTypeFilter) return false;
      if (shiftFilter && normalizeShift(e.shift) !== shiftFilter) return false;
      if (facilityFilter && e.facility !== facilityFilter) return false;
      if (statusFilter) {
        return dates.some((d) => matrix.get(e.code)?.get(d)?.ATTENDANCE_STATUS === statusFilter);
      }
      return true;
    });
  }, [employees, searchQuery, statusFilter, rollTypeFilter, shiftFilter, facilityFilter, dates, matrix]);

  /** Short code shown in the matrix chips (P / AB / UL / WO …), falling back to the full label. */
  function statusCode(status: string): string {
    return MATRIX_CHIP_LABELS[status]?.[1] ?? status;
  }

  function downloadCSV(mode: 'codes' | 'labels') {
    const payrollHeaders = showPayrollDates ? ['Joining Date', 'Exit Date'] : [];
    // The CSV carries the FULL summary column set, including buckets hidden on screen
    // because they are all-zero for the loaded range.
    const summaryHeaders = showSummary
      ? [...SUMMARY_BUCKETS.map((b) => b.label), 'Oth', 'NA', 'Total Days',
         'Actual Present', 'Actual Week Off (incl Comp Off)', 'Final LOP']
      : [];
    const headers = [
      'Employee Code', 'Employee Name', 'Department', 'Reporting Manager', 'Shift',
      ...payrollHeaders, ...dates, ...summaryHeaders,
    ];

    const cell = (status: string | undefined) =>
      !status ? '' : mode === 'codes' ? statusCode(status) : status;

    const rows = filteredEmployees.map((e) => {
      const payrollCols = showPayrollDates ? [e.joiningDate, e.exitDate] : [];
      const dateCols = dates.map((d) => cell(matrix.get(e.code)?.get(d)?.ATTENDANCE_STATUS));
      const lead = [e.code, e.name, e.department, e.reportingManager, e.shift];
      if (!showSummary) return [...lead, ...payrollCols, ...dateCols];
      const s = getSummary(e);
      return [
        ...lead, ...payrollCols, ...dateCols,
        ...SUMMARY_BUCKETS.map((b) => s.counts[b.key]),
        s.oth, s.na, s.totalDays,
        fmtCount(s.actualPresent), s.actualWeekOff, s.finalLop,
      ];
    });

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_matrix_${mode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (records.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
        No records found for this range
      </div>
    );
  }

  const summaryHeadBase: React.CSSProperties = {
    padding: '10px 10px',
    textAlign: 'center',
    fontWeight: 700,
    borderBottom: '2px solid var(--border)',
    whiteSpace: 'nowrap',
    background: 'var(--surface2)',
    fontSize: 11,
    textTransform: 'uppercase',
  };

  const dateCellBase: React.CSSProperties = {
    padding: '10px 10px',
    textAlign: 'center',
    fontWeight: 500,
    borderBottom: '2px solid var(--border)',
    whiteSpace: 'nowrap',
    color: 'var(--text-2)',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 10 }}>
        <button
          onClick={() => downloadCSV('codes')}
          title="P, AB, UL, WO — same codes as the chips above"
          style={{ padding: '7px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer', background: 'var(--surface)' }}
        >
          ↓ CSV (codes)
        </button>
        <button
          onClick={() => downloadCSV('labels')}
          title="Present, Absconding, Unpaid Leave — full status names"
          style={{ padding: '7px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer', background: 'var(--surface)' }}
        >
          ↓ CSV (full)
        </button>
      </div>

      <div style={{ overflowX: 'auto', position: 'relative' }}>
        <table className="matrix-table" style={{ minWidth: 'max-content', fontSize: 12, fontFamily: 'var(--mono)' }}>
          <thead>
            <tr>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '2px solid var(--border)', minWidth: 180 }}>
                Employee
              </th>
              {showPayrollDates && (
                <>
                  <th style={{ ...dateCellBase, color: 'var(--text-2)', fontSize: 11, textTransform: 'uppercase' }}>Joining Date</th>
                  <th style={{ ...dateCellBase, color: 'var(--text-2)', fontSize: 11, textTransform: 'uppercase' }}>Exit Date</th>
                </>
              )}
              {dates.map((d) => (
                <th key={d} style={dateCellBase}>
                  {new Date(d + 'T12:00:00Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </th>
              ))}
              {showSummary && (
                <>
                  {visibleBuckets.map((b, i) => (
                    <th
                      key={b.key}
                      title={b.statuses.join(' + ')}
                      style={{ ...summaryHeadBase, color: SUMMARY_HEAD_COLOR[b.key] ?? 'var(--text-2)', ...(i === 0 ? { borderLeft: '2px solid var(--border)' } : {}) }}
                    >
                      {b.label}
                    </th>
                  ))}
                  {hasOther && <th title="Statuses not yet assigned a column — pending sign-off" style={{ ...summaryHeadBase, color: 'var(--text-3)' }}>Oth</th>}
                  <th title="Days in range with no attendance record, inside the employment window" style={{ ...summaryHeadBase, color: 'var(--warn)' }}>NA</th>
                  <th style={{ ...summaryHeadBase, color: 'var(--text-2)', fontWeight: 500, borderLeft: '2px solid var(--border)' }}>Total Days</th>
                  <th title="P + WOW + 0.5 × H/D" style={{ ...summaryHeadBase, color: 'var(--success)' }}>Actual Present</th>
                  <th title="WO + C/O" style={{ ...summaryHeadBase, color: 'var(--text-2)' }}>Actual Week Off</th>
                  <th title="LOP + UL + A — NA is NOT counted in v1" style={{ ...summaryHeadBase, color: 'var(--danger)' }}>Final LOP</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp) => (
              <tr key={emp.code} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                  <div style={{ fontFamily: 'var(--display)', fontWeight: 500, fontSize: 13 }}>{emp.name}</div>
                  <div style={{ color: 'var(--text-3)', fontSize: 10 }}>{emp.code}</div>
                </td>
                {showPayrollDates && (
                  <>
                    <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: emp.joiningDate ? 'var(--text-2)' : 'var(--text-3)' }}>
                      {emp.joiningDate ? fmtDDMMYYYY(emp.joiningDate) : ''}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: emp.exitDate ? 'var(--text-2)' : 'var(--text-3)' }}>
                      {emp.exitDate ? fmtDDMMYYYY(emp.exitDate) : ''}
                    </td>
                  </>
                )}
                {dates.map((d) => {
                  const rec = matrix.get(emp.code)?.get(d);
                  if (!rec) return <td key={d} style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-3)' }}>—</td>;
                  if (!rec.ATTENDANCE_STATUS) return <td key={d} style={{ padding: '8px 10px' }} />;
                  const chipEntry = MATRIX_CHIP_LABELS[rec.ATTENDANCE_STATUS];
                  if (!chipEntry) return (
                    <td key={d} style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 10 }}>?</td>
                  );
                  const [chipClass, label] = chipEntry;
                  return (
                    <td key={d} style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span
                        className={`chip-${chipClass}`}
                        style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '2px 6px', borderRadius: 4, cursor: 'help', fontWeight: 600, display: 'inline-block' }}
                        onMouseEnter={(e) => {
                          const rect = (e.target as HTMLElement).getBoundingClientRect();
                          setTooltip({ x: rect.left, y: rect.bottom + 6, status: rec.ATTENDANCE_STATUS, remarks: rec.REMARKS, employee: emp.name, date: d });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {label}
                      </span>
                    </td>
                  );
                })}
                {showSummary && (() => {
                  const s = getSummary(emp);
                  const cellBase: React.CSSProperties = { padding: '8px 12px', textAlign: 'center', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, background: 'var(--surface2)' };
                  const zero = (n: number): React.CSSProperties => (n === 0 ? { color: 'var(--text-3)', fontWeight: 400 } : {});
                  return (
                    <>
                      {visibleBuckets.map((b, i) => (
                        <td key={b.key} style={{ ...cellBase, color: SUMMARY_HEAD_COLOR[b.key] ?? 'var(--text-2)', ...zero(s.counts[b.key]), ...(i === 0 ? { borderLeft: '2px solid var(--border)' } : {}) }}>
                          {s.counts[b.key]}
                        </td>
                      ))}
                      {hasOther && <td style={{ ...cellBase, color: 'var(--text-2)', ...zero(s.oth) }}>{s.oth}</td>}
                      <td style={{ ...cellBase, color: 'var(--warn)', ...zero(s.na) }}>{s.na}</td>
                      <td style={{ ...cellBase, color: 'var(--text-2)', fontWeight: 500, borderLeft: '2px solid var(--border)' }}>{s.totalDays}</td>
                      <td style={{ ...cellBase, color: 'var(--success)' }}>{fmtCount(s.actualPresent)}</td>
                      <td style={{ ...cellBase, color: 'var(--text-2)' }}>{s.actualWeekOff}</td>
                      <td style={{ ...cellBase, color: 'var(--danger)' }}>{s.finalLop}</td>
                    </>
                  );
                })()}
              </tr>
            ))}
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan={dates.length + 1 + (showPayrollDates ? 2 : 0) + (showSummary ? visibleBuckets.length + (hasOther ? 1 : 0) + 5 : 0)} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-3)' }}>
                  No employees match the filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x,
          top: tooltip.y,
          background: 'var(--text)',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: 8,
          fontFamily: 'var(--mono)',
          fontSize: 12,
          zIndex: 9999,
          pointerEvents: 'none',
          maxWidth: 280,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.status}</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{tooltip.employee} · {tooltip.date}</div>
          {tooltip.remarks && <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.8)' }}>{tooltip.remarks}</div>}
        </div>
      )}
    </div>
  );
}
