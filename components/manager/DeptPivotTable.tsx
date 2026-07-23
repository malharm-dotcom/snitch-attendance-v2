'use client';

import { useRef, useState } from 'react';
import { ATTENDANCE_STATUSES } from '@/lib/constants';
import ExportControls from './ExportControls';
import { scopeLabel, scopeSlug, reportFilename } from '@/lib/reportExport';
import { istDateString } from '@/lib/ist';

const STATUS_SHORT: Record<string, string> = {
  'Present':           'P',
  'LOP':               'LOP',
  'Week Off':          'WO',
  'Half Day':          'HD',
  'Holiday':           'HOL',
  'Work On Holiday':   'WOH',
  'Sick Leave':        'SL',
  'Paid Leave':        'PL',
  'Unpaid Leave':      'UL',
  'Maternity Leave':   'ML',
  'Paternity Leave':   'PaL',
  'Bereavement Leave': 'BL',
  'Compensatory Off':  'CO',
  'Absconding':        'AB',
};

const STATUS_CELL_BG: Record<string, string> = {
  'Present':           'rgba(220,252,231,0.55)',
  'LOP':               'rgba(254,226,226,0.55)',
  'Week Off':          'rgba(237,233,254,0.55)',
  'Half Day':          'rgba(254,249,195,0.55)',
  'Holiday':           'rgba(224,242,254,0.55)',
  'Work On Holiday':   'rgba(220,252,231,0.35)',
  'Sick Leave':        'rgba(255,237,213,0.55)',
  'Paid Leave':        'rgba(219,234,254,0.55)',
  'Unpaid Leave':      'rgba(254,226,226,0.35)',
  'Maternity Leave':   'rgba(243,232,255,0.55)',
  'Paternity Leave':   'rgba(243,232,255,0.55)',
  'Bereavement Leave': 'rgba(243,232,255,0.55)',
  'Compensatory Off':  'rgba(254,249,195,0.35)',
  'Absconding':        'rgba(254,202,202,0.55)',
};

export interface PivotRow {
  department: string;
  statusCounts: Record<string, number>;
  total: number;
}

interface Props {
  rows: PivotRow[];
  grandTotals: Record<string, number>;
  grandTotal: number;
  facility: string;
  fromDate: string;
  toDate: string;
  /** Shift the report was run with, echoed by the API: 'All' | 'Day' | 'Night'. */
  shift: string;
}

const th: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  padding: '10px 8px',
  textAlign: 'center',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-2)',
  whiteSpace: 'nowrap',
  background: 'var(--surface2)',
  borderBottom: '2px solid var(--border)',
  minWidth: 44,
  fontWeight: 500,
};

export default function DeptPivotTable({ rows, grandTotals, grandTotal, facility, fromDate, toDate, shift }: Props) {
  const [showAll, setShowAll] = useState(false);
  const priorShowAll = useRef(false);
  const captureRef = useRef<HTMLDivElement>(null);

  // A status column is "empty" when it is zero across every row (grandTotals sums all rows).
  const nonEmptyStatuses = ATTENDANCE_STATUSES.filter((s) => (grandTotals[s] ?? 0) > 0);
  const hiddenCount = ATTENDANCE_STATUSES.length - nonEmptyStatuses.length;
  // On-screen columns respect the toggle; CSV always uses the full set.
  const displayStatuses = showAll ? ATTENDANCE_STATUSES : nonEmptyStatuses;

  function downloadCSV() {
    const headers = ['Department', ...ATTENDANCE_STATUSES, 'Total'];
    const dataRows = rows.map((r) => [
      r.department,
      ...ATTENDANCE_STATUSES.map((s) => String(r.statusCounts[s] ?? 0)),
      String(r.total),
    ]);
    const totalsRow = [
      'TOTAL',
      ...ATTENDANCE_STATUSES.map((s) => String(grandTotals[s] ?? 0)),
      String(grandTotal),
    ];
    const csv = [headers, ...dataRows, totalsRow]
      .map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dept-pivot-${shift.toLowerCase()}-${fromDate}_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-2)' }}>
          <span>{rows.length} department{rows.length !== 1 ? 's' : ''}</span>
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              style={{ padding: '5px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', background: 'var(--surface)', color: 'var(--text-2)' }}
            >
              {showAll ? 'Hide empty columns' : `Show all columns (${hiddenCount} hidden)`}
            </button>
          )}
        </span>
        <ExportControls
          onDownloadCSV={downloadCSV}
          captureRef={captureRef}
          pngFilename={reportFilename('dept-pivot', scopeSlug(facility), istDateString(), 'png')}
          meta={{
            title: 'Department Pivot',
            scope: `${scopeLabel(facility)}  ·  ${shift} shift`,
            range: `${fromDate} → ${toDate}`,
          }}
          onBeforeCapture={() => { priorShowAll.current = showAll; setShowAll(true); }}
          onAfterCapture={() => setShowAll(priorShowAll.current)}
        />
      </div>

      <div ref={captureRef} style={{ overflowX: 'auto' }}>
        <table style={{ fontSize: 12, fontFamily: 'var(--mono)', minWidth: 'max-content', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              {/* Department header — sticky left + top */}
              <th style={{
                ...th,
                position: 'sticky',
                left: 0,
                top: 0,
                textAlign: 'left',
                padding: '10px 14px',
                zIndex: 4,
                minWidth: 170,
                borderRight: '1px solid var(--border)',
              }}>
                Department
              </th>
              {displayStatuses.map((s) => (
                <th key={s} title={s} style={th}>{STATUS_SHORT[s] ?? s}</th>
              ))}
              <th style={{
                ...th,
                textAlign: 'center',
                padding: '10px 14px',
                color: 'var(--text)',
                fontWeight: 700,
                borderLeft: '2px solid var(--border2)',
                minWidth: 56,
              }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const rowBg = i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)';
              return (
                <tr key={row.department} className="hover-row" style={{ borderBottom: '1px solid var(--border)', background: rowBg }}>
                  <td style={{
                    padding: '8px 14px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    color: 'var(--text)',
                    fontFamily: 'var(--display)',
                    fontSize: 13,
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    background: rowBg,
                    borderBottom: '1px solid var(--border)',
                    borderRight: '1px solid var(--border)',
                  }}>
                    {row.department}
                  </td>
                  {displayStatuses.map((s) => {
                    const count = row.statusCounts[s] ?? 0;
                    return (
                      <td key={s} style={{
                        padding: '8px',
                        textAlign: 'center',
                        background: count > 0 ? STATUS_CELL_BG[s] : undefined,
                        borderBottom: '1px solid var(--border)',
                      }}>
                        {count > 0
                          ? <strong style={{ color: 'var(--text)' }}>{count}</strong>
                          : <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </td>
                    );
                  })}
                  <td style={{
                    padding: '8px 14px',
                    textAlign: 'center',
                    fontWeight: 700,
                    borderLeft: '2px solid var(--border2)',
                    borderBottom: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}>
                    {row.total}
                  </td>
                </tr>
              );
            })}

            {/* Grand totals row */}
            <tr style={{ borderTop: '2px solid var(--border2)', background: 'var(--surface2)' }}>
              <td style={{
                padding: '10px 14px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                fontFamily: 'var(--display)',
                fontSize: 13,
                color: 'var(--text)',
                position: 'sticky',
                left: 0,
                zIndex: 1,
                background: 'var(--surface2)',
                borderRight: '1px solid var(--border)',
              }}>
                TOTAL
              </td>
              {displayStatuses.map((s) => {
                const count = grandTotals[s] ?? 0;
                return (
                  <td key={s} style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>
                    {count > 0 ? count : <span style={{ color: 'var(--text-3)' }}>—</span>}
                  </td>
                );
              })}
              <td style={{
                padding: '10px 14px',
                textAlign: 'center',
                fontWeight: 700,
                borderLeft: '2px solid var(--border2)',
                color: 'var(--accent)',
                fontSize: 14,
              }}>
                {grandTotal}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
