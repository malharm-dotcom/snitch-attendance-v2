'use client';

import { useRef } from 'react';
import { istDateString } from '@/lib/ist';
import { scopeLabel, scopeSlug, reportFilename } from '@/lib/reportExport';
import ExportControls from './ExportControls';
import EmptyState from './EmptyState';

export interface OtReportRow {
  employeeCode: string;
  employeeName: string;
  department: string;
  facility: string;
  month: string;
  approvedHours: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface OtReportData {
  scope: string;
  rows: OtReportRow[];
  totals: { approvedHours: number; pending: number; approved: number; rejected: number };
}

interface Props {
  data: OtReportData;
  facility: string;
  fromDate: string;
  toDate: string;
}

const th: React.CSSProperties = {
  position: 'sticky', top: 0, zIndex: 3,
  padding: '10px 14px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
  color: 'var(--text-2)', whiteSpace: 'nowrap', background: 'var(--surface2)',
  borderBottom: '2px solid var(--border)', fontWeight: 500,
};
const numTh: React.CSSProperties = { ...th, textAlign: 'right' };
const cell: React.CSSProperties = { padding: '8px 14px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' };
const numCell: React.CSSProperties = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

function Num({ value, bold }: { value: number; bold?: boolean }) {
  if (value === 0) return <span style={{ color: 'var(--text-3)' }}>&ndash;</span>;
  return <span style={{ fontWeight: bold ? 700 : 400 }}>{value}</span>;
}

export default function OtReportTable({ data, facility, fromDate, toDate }: Props) {
  const captureRef = useRef<HTMLDivElement>(null);

  if (!data.rows.length) return <EmptyState />;

  function downloadCSV() {
    const headers = ['Month', 'Employee Code', 'Employee Name', 'Department', 'Facility',
      'Approved OT (hrs)', 'Pending', 'Approved', 'Rejected'];
    const body = data.rows.map((r) => [
      r.month, r.employeeCode, r.employeeName, r.department, r.facility,
      r.approvedHours, r.pending, r.approved, r.rejected,
    ]);
    const totals = ['TOTAL', '', '', '', '',
      data.totals.approvedHours, data.totals.pending, data.totals.approved, data.totals.rejected];
    const csv = [headers, ...body, totals]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = reportFilename('ot-report', scopeSlug(facility), istDateString(), 'csv');
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-2)' }}>
          {data.rows.length} employee-month rows · {data.totals.approvedHours} approved hrs
        </span>
        <ExportControls
          onDownloadCSV={downloadCSV}
          captureRef={captureRef}
          pngFilename={reportFilename('ot-report', scopeSlug(facility), istDateString(), 'png')}
          meta={{ title: 'Overtime Report', scope: scopeLabel(facility), range: `${fromDate} → ${toDate}` }}
        />
      </div>

      <div ref={captureRef} style={{ overflowX: 'auto', maxHeight: 480 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--mono)' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Month</th>
              <th style={{ ...th, textAlign: 'left' }}>Employee</th>
              <th style={{ ...th, textAlign: 'left' }}>Department</th>
              <th style={{ ...th, textAlign: 'left' }}>Facility</th>
              <th style={numTh}>Approved OT (hrs)</th>
              <th style={numTh}>Pending</th>
              <th style={numTh}>Approved</th>
              <th style={numTh}>Rejected</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={`${r.month}-${r.employeeCode}`}>
                <td style={cell}>{r.month}</td>
                <td style={cell}>
                  <div style={{ fontFamily: 'var(--display)', fontWeight: 500, fontSize: 13 }}>{r.employeeName || r.employeeCode}</div>
                  <div style={{ color: 'var(--text-3)', fontSize: 10 }}>{r.employeeCode}</div>
                </td>
                <td style={cell}>{r.department}</td>
                <td style={cell}>{r.facility}</td>
                <td style={{ ...numCell, fontWeight: 700, color: r.approvedHours > 0 ? 'var(--success)' : 'var(--text-3)' }}>
                  {r.approvedHours > 0 ? r.approvedHours : <span>&ndash;</span>}
                </td>
                <td style={numCell}><Num value={r.pending} /></td>
                <td style={numCell}><Num value={r.approved} /></td>
                <td style={numCell}><Num value={r.rejected} /></td>
              </tr>
            ))}
            <tr style={{ background: 'var(--surface2)' }}>
              <td style={{ ...cell, fontWeight: 700 }} colSpan={4}>Total</td>
              <td style={{ ...numCell, fontWeight: 700, color: 'var(--success)' }}>{data.totals.approvedHours}</td>
              <td style={numCell}><Num value={data.totals.pending} bold /></td>
              <td style={numCell}><Num value={data.totals.approved} bold /></td>
              <td style={numCell}><Num value={data.totals.rejected} bold /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
