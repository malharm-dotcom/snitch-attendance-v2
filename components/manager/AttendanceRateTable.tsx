'use client';

export interface RateRow {
  date: string;
  facility: string;
  department?: string;
  eligible: number;
  marked: number;
  presentLike: number;
  absentLike: number;
  attendancePct: number | null;
  absenteeismPct: number | null;
  pendingPct: number | null;
}

export interface RateData {
  scope: string;
  level: 'facility' | 'department';
  shift: string;
  rows: RateRow[];
  warnings: string[];
}

interface Props {
  data: RateData;
  fromDate: string;
  toDate: string;
}

const NUM_COL_WIDTH = 92;

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

const td: React.CSSProperties = {
  padding: '8px 14px',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border)',
};

/** Percentage cell: full 2-decimal value + a thin muted meter underneath. */
function PctCell({ value, barColor }: { value: number | null; barColor: string }) {
  if (value === null) {
    return <td style={td}><span style={{ color: 'var(--text-3)' }}>&ndash;</span></td>;
  }
  const outOfRange = value < 0 || value > 100;
  return (
    <td style={td}>
      <span style={{ color: outOfRange ? 'var(--danger)' : 'var(--text)', fontWeight: outOfRange ? 700 : 400 }}>
        {value.toFixed(2)}%
      </span>
      <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', marginTop: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, value))}%`, background: barColor, borderRadius: 2 }} />
      </div>
    </td>
  );
}

export default function AttendanceRateTable({ data, fromDate, toDate }: Props) {
  const byDept = data.level === 'department';

  function downloadCSV() {
    const headers = ['Date', 'Facility', ...(byDept ? ['Department'] : []), 'Eligible', 'Marked', 'Attendance %', 'Absenteeism %', 'Pending %'];
    const dataRows = data.rows.map((r) => [
      r.date,
      r.facility,
      ...(byDept ? [r.department ?? ''] : []),
      String(r.eligible),
      String(r.marked),
      r.attendancePct === null ? '' : r.attendancePct.toFixed(2),
      r.absenteeismPct === null ? '' : r.absenteeismPct.toFixed(2),
      r.pendingPct === null ? '' : r.pendingPct.toFixed(2),
    ]);
    const csv = [headers, ...dataRows]
      .map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-rate-${byDept ? 'by-dept-' : ''}${data.shift.toLowerCase()}-${fromDate}_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-2)', display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          <span className="badge" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>{data.scope}</span>
          <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text-2)' }}>{data.shift} shift</span>
          <span style={{ marginLeft: 4 }}>{data.rows.length} {byDept ? 'date-facility-dept' : 'day-facility'} rows</span>
        </span>
        <button
          onClick={downloadCSV}
          style={{ padding: '7px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer', background: 'var(--surface)' }}
        >
          &darr; Download CSV
        </button>
      </div>

      {data.warnings.length > 0 && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--r)', padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--danger)' }}>
          <strong>Data integrity warnings ({data.warnings.length}):</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {data.warnings.slice(0, 10).map((w, i) => <li key={i}>{w}</li>)}
            {data.warnings.length > 10 && <li>&hellip; and {data.warnings.length - 10} more (see server logs)</li>}
          </ul>
        </div>
      )}

      {data.rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
          No data for the selected date range
        </div>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
          <table style={{ fontSize: 13, fontFamily: 'var(--mono)', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={{ ...th, left: 0, zIndex: 4, textAlign: 'left', minWidth: 120, borderRight: '1px solid var(--border)' }}>Date</th>
                <th style={{ ...th, textAlign: 'left', minWidth: 80 }}>Facility</th>
                {byDept && <th style={{ ...th, textAlign: 'left', minWidth: 130 }}>Department</th>}
                <th style={th}>Eligible</th>
                <th style={th}>Marked</th>
                <th style={th}>Attendance %</th>
                <th style={th}>Absenteeism %</th>
                <th style={th}>Pending %</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={`${r.date}|${r.facility}|${r.department ?? ''}`} className="hover-row" style={{ background: 'var(--surface)' }}>
                  <td style={{
                    ...td,
                    textAlign: 'left',
                    fontFamily: 'var(--mono)',
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    background: 'var(--surface)',
                    borderRight: '1px solid var(--border)',
                  }}>
                    {r.date}
                  </td>
                  <td style={{ ...td, textAlign: 'left', color: 'var(--text-2)' }}>{r.facility}</td>
                  {byDept && <td style={{ ...td, textAlign: 'left', fontFamily: 'var(--display)', color: 'var(--text)' }}>{r.department}</td>}
                  <td style={td}>{r.eligible === 0 ? <span style={{ color: 'var(--text-3)' }}>&ndash;</span> : r.eligible}</td>
                  <td style={td}>{r.marked === 0 ? <span style={{ color: 'var(--text-3)' }}>&ndash;</span> : r.marked}</td>
                  <PctCell value={r.attendancePct} barColor="var(--success)" />
                  <PctCell value={r.absenteeismPct} barColor="var(--danger)" />
                  <PctCell value={r.pendingPct} barColor="var(--warn)" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
