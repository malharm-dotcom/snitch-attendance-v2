'use client';

import { STATUS_CLASSES } from '@/lib/constants';
import type { HistoryRecord } from '@/lib/types';

interface HistoryTableProps {
  records: HistoryRecord[];
  searchQuery: string;
  statusFilter: string;
}

function downloadCSV(records: HistoryRecord[]) {
  const headers = ['Employee Code', 'Employee Name', 'Status', 'Remarks', 'Marked By', 'Marked At', 'Facility', 'Department'];
  const rows = records.map((r) => [
    r.EMPLOYEE_CODE, r.EMPLOYEE_NAME, r.ATTENDANCE_STATUS,
    r.REMARKS ?? '', r.MARKED_BY, r.MARKED_AT, r.FACILITY, r.DEPARTMENT,
  ]);
  const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'attendance.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function HistoryTable({ records, searchQuery, statusFilter }: HistoryTableProps) {
  const filtered = records.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || r.EMPLOYEE_NAME.toLowerCase().includes(q) || r.EMPLOYEE_CODE.toLowerCase().includes(q);
    const matchStatus = !statusFilter || r.ATTENDANCE_STATUS === statusFilter;
    return matchSearch && matchStatus;
  });

  if (records.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
        No records found for this date
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button
          onClick={() => downloadCSV(filtered)}
          style={{ padding: '7px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer', background: 'var(--surface)' }}
        >
          ↓ CSV
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--mono)' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--surface2)' }}>
              {['Employee', 'Code', 'Status', 'Remarks', 'Marked By', 'Marked At'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--text-2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const cls = STATUS_CLASSES[r.ATTENDANCE_STATUS] ?? 'present';
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
                  <td style={{ padding: '9px 12px', fontFamily: 'var(--display)', fontWeight: 500 }}>{r.EMPLOYEE_NAME}</td>
                  <td style={{ padding: '9px 12px', color: 'var(--text-3)' }}>{r.EMPLOYEE_CODE}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <span className={`chip-${cls}`} style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                      {r.ATTENDANCE_STATUS}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', color: 'var(--text-2)', maxWidth: 200 }}>{r.REMARKS ?? '—'}</td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{r.MARKED_BY}</td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: 'var(--text-3)' }}>
                    {new Date(r.MARKED_AT).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
            No records match the filter
          </div>
        )}
      </div>
    </div>
  );
}
