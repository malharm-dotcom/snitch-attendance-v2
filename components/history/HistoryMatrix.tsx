'use client';

import { useMemo, useState } from 'react';
import { MATRIX_CHIP_LABELS } from '@/lib/constants';
import type { HistoryRecord } from '@/lib/types';

interface HistoryMatrixProps {
  records: HistoryRecord[];
  searchQuery: string;
  statusFilter: string;
}

interface TooltipState {
  x: number;
  y: number;
  status: string;
  remarks: string | null;
  employee: string;
  date: string;
}

export default function HistoryMatrix({ records, searchQuery, statusFilter }: HistoryMatrixProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { employees, dates, matrix } = useMemo(() => {
    const dateSet = new Set<string>();
    const empMap = new Map<string, { code: string; name: string }>();

    for (const r of records) {
      if (!r.ATTENDANCE_DATE) continue;
      const dateStr = String(r.ATTENDANCE_DATE).slice(0, 10);
      dateSet.add(dateStr);
      empMap.set(r.EMPLOYEE_CODE, { code: r.EMPLOYEE_CODE, name: r.EMPLOYEE_NAME });
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
    const headers = ['Employee Code', 'Employee Name', ...dates];
    const rows = filteredEmployees.map((e) => [
      e.code, e.name,
      ...dates.map((d) => matrix.get(e.code)?.get(d)?.ATTENDANCE_STATUS ?? ''),
    ]);
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
              {dates.map((d) => (
                <th key={d} style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 500, borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--text-2)' }}>
                  {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp) => (
              <tr key={emp.code} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                  <div style={{ fontFamily: 'var(--display)', fontWeight: 500, fontSize: 13 }}>{emp.name}</div>
                  <div style={{ color: 'var(--text-3)', fontSize: 10 }}>{emp.code}</div>
                </td>
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
              </tr>
            ))}
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan={dates.length + 1} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-3)' }}>
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
