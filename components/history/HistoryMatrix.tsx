'use client';

import { useMemo, useState } from 'react';
import { MATRIX_CHIP_LABELS } from '@/lib/constants';
import type { HistoryRecord } from '@/lib/types';

interface HistoryMatrixProps {
  records: HistoryRecord[];
  searchQuery: string;
  statusFilter: string;
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
  fromDate,
  toDate,
  showSummary = false,
  showPayrollDates = false,
}: HistoryMatrixProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { employees, dates, matrix } = useMemo(() => {
    const dateSet = new Set<string>();
    const empMap = new Map<string, { code: string; name: string; joiningDate: string; exitDate: string }>();

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

  const totalDays = useMemo(() => {
    if (!showSummary || !fromDate || !toDate) return 0;
    return (
      Math.round(
        (new Date(toDate + 'T00:00:00Z').getTime() - new Date(fromDate + 'T00:00:00Z').getTime()) / 86400000
      ) + 1
    );
  }, [showSummary, fromDate, toDate]);

  function getSummary(code: string) {
    const present = dates.filter((d) => {
      const s = matrix.get(code)?.get(d)?.ATTENDANCE_STATUS;
      return s === 'Present' || s === 'Work on Week Off';
    }).length;
    const lop = dates.filter((d) => {
      const s = matrix.get(code)?.get(d)?.ATTENDANCE_STATUS;
      return s === 'LOP' || s === 'Unpaid Leave';
    }).length;
    const absent = Math.max(0, totalDays - present - lop);
    return { present, lop, absent };
  }

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (statusFilter) {
        return dates.some((d) => matrix.get(e.code)?.get(d)?.ATTENDANCE_STATUS === statusFilter);
      }
      return true;
    });
  }, [employees, searchQuery, statusFilter, dates, matrix]);

  function downloadCSV() {
    const payrollHeaders = showPayrollDates ? ['Joining Date', 'Exit Date'] : [];
    const summaryHeaders = showSummary ? ['Present', 'LOP', 'Total Days', 'Absent'] : [];
    const headers = ['Employee Code', 'Employee Name', ...payrollHeaders, ...dates, ...summaryHeaders];

    const rows = filteredEmployees.map((e) => {
      const payrollCols = showPayrollDates ? [e.joiningDate, e.exitDate] : [];
      const dateCols = dates.map((d) => matrix.get(e.code)?.get(d)?.ATTENDANCE_STATUS ?? '');
      if (!showSummary) return [e.code, e.name, ...payrollCols, ...dateCols];
      const { present, lop, absent } = getSummary(e.code);
      return [e.code, e.name, ...payrollCols, ...dateCols, present, lop, totalDays, absent];
    });

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'attendance_matrix.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  if (records.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
        No records found for this range
      </div>
    );
  }

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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button
          onClick={downloadCSV}
          style={{ padding: '7px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer', background: 'var(--surface)' }}
        >
          ↓ CSV
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
                  <th style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid var(--border)', borderLeft: '2px solid var(--border)', whiteSpace: 'nowrap', background: 'var(--surface2)', color: 'var(--success)', fontSize: 11, textTransform: 'uppercase' }}>Present</th>
                  <th style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', background: 'var(--surface2)', color: 'var(--danger)', fontSize: 11, textTransform: 'uppercase' }}>LOP</th>
                  <th style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', background: 'var(--surface2)', color: 'var(--text-2)', fontSize: 11, textTransform: 'uppercase' }}>/{totalDays}d</th>
                  <th style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700, borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', background: 'var(--surface2)', color: 'var(--warn)', fontSize: 11, textTransform: 'uppercase' }}>Absent</th>
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
                  const { present, lop, absent } = getSummary(emp.code);
                  const cellBase: React.CSSProperties = { padding: '8px 12px', textAlign: 'center', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, background: 'var(--surface2)' };
                  return (
                    <>
                      <td style={{ ...cellBase, borderLeft: '2px solid var(--border)', color: 'var(--success)' }}>{present}</td>
                      <td style={{ ...cellBase, color: 'var(--danger)' }}>{lop}</td>
                      <td style={{ ...cellBase, color: 'var(--text-2)', fontWeight: 500 }}>{totalDays}</td>
                      <td style={{ ...cellBase, color: 'var(--warn)' }}>{absent}</td>
                    </>
                  );
                })()}
              </tr>
            ))}
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan={dates.length + 1 + (showPayrollDates ? 2 : 0) + (showSummary ? 4 : 0)} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-3)' }}>
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
