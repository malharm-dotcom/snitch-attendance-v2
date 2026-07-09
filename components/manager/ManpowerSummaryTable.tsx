'use client';

import { useMemo, useState } from 'react';
import { istDateString } from '@/lib/ist';

export interface ManpowerPivotRow {
  label: string;
  group?: string;
  isSubtotal?: boolean;
  counts: Record<string, number>;
  total: number;
}

export interface ManpowerPivot {
  columns: string[];
  rows: ManpowerPivotRow[];
  columnTotals: Record<string, number>;
  grandTotal: number;
}

export type ManpowerLevel = 'roll-gender' | 'shift-gender' | 'dept-roll' | 'dept-desig';

export interface ManpowerData {
  scope: string;
  totalActive: number;
  pivots: Record<ManpowerLevel, ManpowerPivot>;
}

const LEVELS: { id: ManpowerLevel; label: string; rowHeader: string }[] = [
  { id: 'roll-gender', label: 'Roll Type × Gender', rowHeader: 'Roll Type' },
  { id: 'shift-gender', label: 'Shift × Gender', rowHeader: 'Shift' },
  { id: 'dept-roll', label: 'Department × Roll Type', rowHeader: 'Department' },
  { id: 'dept-desig', label: 'Dept + Designation × Roll Type', rowHeader: 'Department / Designation' },
];

// Shared cell styles — fixed widths so switching levels doesn't reflow.
const FIRST_COL_WIDTH = 240;
const NUM_COL_WIDTH = 104;

const numCell: React.CSSProperties = {
  padding: '8px 14px',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  minWidth: NUM_COL_WIDTH,
  borderBottom: '1px solid var(--border)',
};

const th: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 3,
  padding: '10px 14px',
  textAlign: 'right',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-2)',
  whiteSpace: 'nowrap',
  background: 'var(--surface2)',
  borderBottom: '2px solid var(--border)',
  minWidth: NUM_COL_WIDTH,
  fontWeight: 500,
};

function Num({ value, bold }: { value: number; bold?: boolean }) {
  if (value === 0) return <span style={{ color: 'var(--text-3)' }}>&ndash;</span>;
  return <span style={{ fontWeight: bold ? 700 : 400, color: 'var(--text)' }}>{value.toLocaleString('en-IN', { useGrouping: false })}</span>;
}

export default function ManpowerSummaryTable({ data }: { data: ManpowerData }) {
  const [level, setLevel] = useState<ManpowerLevel>('roll-gender');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const pivot = data.pivots[level];
  const levelMeta = LEVELS.find((l) => l.id === level)!;
  const nested = level === 'dept-desig';

  const visibleRows = useMemo(() => {
    if (!nested) return pivot.rows;
    return pivot.rows.filter((r) => r.isSubtotal || !collapsed.has(r.group ?? ''));
  }, [pivot.rows, nested, collapsed]);

  function toggleDept(dept: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  }

  function downloadCSV() {
    const headers = [levelMeta.rowHeader, ...pivot.columns, 'Total'];
    const dataRows = pivot.rows.map((r) => [
      nested && !r.isSubtotal ? `${r.group} — ${r.label}` : nested ? `${r.group} — Subtotal` : r.label,
      ...pivot.columns.map((c) => String(r.counts[c] ?? 0)),
      String(r.total),
    ]);
    const totalsRow = ['TOTAL', ...pivot.columns.map((c) => String(pivot.columnTotals[c] ?? 0)), String(pivot.grandTotal)];
    const csv = [headers, ...dataRows, totalsRow]
      .map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manpower-summary-${level}-${istDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Level selector */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', padding: 3, borderRadius: 'var(--r)', width: 'fit-content', flexWrap: 'wrap' }}>
        {LEVELS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLevel(l.id)}
            style={{
              padding: '6px 13px',
              border: 'none',
              borderRadius: 8,
              background: level === l.id ? 'var(--surface)' : 'transparent',
              color: level === l.id ? 'var(--text)' : 'var(--text-2)',
              fontFamily: 'var(--mono)',
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: level === l.id ? 600 : 400,
              boxShadow: level === l.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Header line: scope + total + export */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-2)' }}>
          <span className="badge" style={{ background: 'var(--accent-glow)', color: 'var(--accent)', marginRight: 8 }}>{data.scope}</span>
          {data.totalActive} active employees
        </span>
        <button
          onClick={downloadCSV}
          style={{ padding: '7px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer', background: 'var(--surface)' }}
        >
          &darr; Download CSV
        </button>
      </div>

      {pivot.rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
          No active employees in scope
        </div>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
          <table style={{ fontSize: 13, fontFamily: 'var(--mono)', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={{ ...th, left: 0, zIndex: 4, textAlign: 'left', minWidth: FIRST_COL_WIDTH, borderRight: '1px solid var(--border)' }}>
                  {levelMeta.rowHeader}
                </th>
                {pivot.columns.map((c) => (
                  <th key={c} style={th}>{c}</th>
                ))}
                <th style={{ ...th, color: 'var(--text)', fontWeight: 700, borderLeft: '2px solid var(--border2)' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, i) => {
                const isSub = !!row.isSubtotal;
                const rowBg = isSub ? 'var(--surface2)' : 'var(--surface)';
                const isCollapsed = nested && isSub && collapsed.has(row.group ?? '');
                return (
                  <tr key={`${row.group ?? ''}|${row.label}|${i}`} className={isSub ? undefined : 'hover-row'} style={{ background: rowBg }}>
                    <td
                      onClick={nested && isSub ? () => toggleDept(row.group!) : undefined}
                      style={{
                        padding: nested && !isSub ? '8px 14px 8px 32px' : '8px 14px',
                        whiteSpace: 'nowrap',
                        fontFamily: 'var(--display)',
                        fontSize: 13,
                        fontWeight: isSub ? 700 : 400,
                        color: isSub ? 'var(--text)' : 'var(--text-2)',
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        background: rowBg,
                        borderBottom: '1px solid var(--border)',
                        borderRight: '1px solid var(--border)',
                        minWidth: FIRST_COL_WIDTH,
                        cursor: nested && isSub ? 'pointer' : undefined,
                        userSelect: nested && isSub ? 'none' : undefined,
                      }}
                      title={nested && isSub ? (isCollapsed ? 'Expand designations' : 'Collapse designations') : undefined}
                    >
                      {nested && isSub ? (
                        <>
                          <span style={{ display: 'inline-block', width: 14, color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                            {isCollapsed ? '+' : '−'}
                          </span>
                          {row.group}
                        </>
                      ) : (
                        row.label
                      )}
                    </td>
                    {pivot.columns.map((c) => (
                      <td key={c} style={numCell}>
                        <Num value={row.counts[c] ?? 0} bold={isSub} />
                      </td>
                    ))}
                    <td style={{ ...numCell, fontWeight: 700, borderLeft: '2px solid var(--border2)' }}>
                      <Num value={row.total} bold />
                    </td>
                  </tr>
                );
              })}

              {/* Grand total row */}
              <tr style={{ background: 'var(--surface2)' }}>
                <td style={{
                  padding: '10px 14px',
                  fontWeight: 700,
                  fontFamily: 'var(--display)',
                  fontSize: 13,
                  color: 'var(--text)',
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  background: 'var(--surface2)',
                  borderTop: '2px solid var(--border2)',
                  borderRight: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                }}>
                  TOTAL
                </td>
                {pivot.columns.map((c) => (
                  <td key={c} style={{ ...numCell, fontWeight: 700, borderTop: '2px solid var(--border2)', borderBottom: 'none' }}>
                    <Num value={pivot.columnTotals[c] ?? 0} bold />
                  </td>
                ))}
                <td style={{ ...numCell, fontWeight: 700, borderTop: '2px solid var(--border2)', borderLeft: '2px solid var(--border2)', borderBottom: 'none', color: 'var(--accent)', fontSize: 14 }}>
                  {pivot.grandTotal.toLocaleString('en-IN', { useGrouping: false })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
