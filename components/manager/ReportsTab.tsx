'use client';

import { useRef, useState } from 'react';
import { DEPARTMENTS } from '@/lib/constants';
import { istDateString } from '@/lib/ist';
import { scopeLabel, scopeSlug, reportFilename } from '@/lib/reportExport';
import { useToast } from '../shared/Toast';
import DeptPivotTable from './DeptPivotTable';
import ManpowerSummaryTable, { type ManpowerData } from './ManpowerSummaryTable';
import AttendanceRateTable, { type RateData } from './AttendanceRateTable';
import ExportControls from './ExportControls';
import EmptyState from './EmptyState';

interface ReportsTabProps {
  facility: string;
}

type ReportType = 'daily' | 'range' | 'pivot' | 'manpower' | 'rate';

interface PivotResult {
  rows: { department: string; statusCounts: Record<string, number>; total: number }[];
  grandTotals: Record<string, number>;
  grandTotal: number;
}

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsTab({ facility }: ReportsTabProps) {
  const today = istDateString();
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [date, setDate] = useState(today);
  const [shift, setShift] = useState('');
  const [fromDate, setFromDate] = useState(istDateString(new Date(Date.now() - 29 * 86400000)));
  const [toDate, setToDate] = useState(today);
  const [deptFilter, setDeptFilter] = useState('');
  const [data, setData] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [pivotData, setPivotData] = useState<PivotResult | null>(null);
  const [manpowerData, setManpowerData] = useState<ManpowerData | null>(null);
  const [rateData, setRateData] = useState<RateData | null>(null);
  const [rateRange, setRateRange] = useState<{ from: string; to: string }>({ from: fromDate, to: toDate });
  const [pivotRange, setPivotRange] = useState<{ from: string; to: string }>({ from: fromDate, to: toDate });
  const [rateLevel, setRateLevel] = useState<'facility' | 'department'>('facility');
  const [genericRange, setGenericRange] = useState<{ label: string; range: string; base: string }>({ label: 'Report', range: '', base: 'report' });
  const genericTableRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  async function runReport() {
    setLoading(true);
    setData(null);
    setPivotData(null);
    setManpowerData(null);
    setRateData(null);
    try {
      let url = '';

      if (reportType === 'daily') {
        const params = new URLSearchParams({ date, facility });
        if (shift) params.append('shift', shift);
        url = `/api/reports/daily-summary?${params}`;
      } else if (reportType === 'range') {
        const params = new URLSearchParams({ from_date: fromDate, to_date: toDate, facility });
        if (deptFilter) params.append('department', deptFilter);
        if (shift) params.append('shift', shift);
        url = `/api/reports/range?${params}`;
      } else if (reportType === 'pivot') {
        url = `/api/reports/department-pivot?from=${fromDate}&to=${toDate}`;
      } else if (reportType === 'manpower') {
        url = `/api/reports/manpower-summary`;
      } else if (reportType === 'rate') {
        const params = new URLSearchParams({ from: fromDate, to: toDate, level: rateLevel });
        if (shift) params.append('shift', shift);
        url = `/api/reports/attendance-rate?${params}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Report failed (${res.status})`);
      }
      const json = await res.json();

      if (reportType === 'pivot') {
        setPivotData(json);
        setPivotRange({ from: fromDate, to: toDate });
        if (!json.rows?.length) showToast('No data found for this filter', 'info');
      } else if (reportType === 'manpower') {
        setManpowerData(json);
        if (!json.totalActive) showToast('No active employees in scope', 'info');
      } else if (reportType === 'rate') {
        setRateData(json);
        setRateRange({ from: fromDate, to: toDate });
        if (!json.rows?.length) showToast('No data found for this date range', 'info');
      } else {
        const rows = json.rows ?? json.employees ?? [];
        setData(rows);
        if (reportType === 'range') {
          setGenericRange({ label: 'Raw Table', range: `${fromDate} → ${toDate}`, base: 'raw-table' });
        } else {
          setGenericRange({ label: 'Daily Summary', range: date, base: 'daily-summary' });
        }
        if (rows.length === 0) showToast('No data found for this filter', 'info');
      }
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to load report', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18, margin: 0 }}>Reports</h2>

      {/* Report type selector */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', padding: 3, borderRadius: 'var(--r)', width: 'fit-content' }}>
        {([
          { id: 'range', label: 'Raw Table' },
          { id: 'daily', label: 'Daily Summary' },
          { id: 'pivot', label: 'Dept Pivot' },
          { id: 'manpower', label: 'Manpower Summary' },
          { id: 'rate', label: 'Attendance Rate' },
        ] as { id: ReportType; label: string }[]).map((r) => (
          <button
            key={r.id}
            onClick={() => setReportType(r.id)}
            style={{
              padding: '7px 16px',
              border: 'none',
              borderRadius: 8,
              background: reportType === r.id ? 'var(--surface)' : 'transparent',
              color: reportType === r.id ? 'var(--text)' : 'var(--text-2)',
              fontFamily: 'var(--mono)',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: reportType === r.id ? 600 : 400,
              boxShadow: reportType === r.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {reportType === 'daily' && (
          <>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Date</label>
              <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--mono)', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Shift</label>
              <select value={shift} onChange={(e) => setShift(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--mono)', fontSize: 13, background: 'var(--surface)' }}>
                <option value="">All shifts</option>
                <option value="Day">Day</option>
                <option value="Night">Night</option>
              </select>
            </div>
          </>
        )}

        {(reportType === 'range' || reportType === 'pivot' || reportType === 'rate') && (
          <>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>From</label>
              <input type="date" value={fromDate} max={today} onChange={(e) => setFromDate(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--mono)', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>To</label>
              <input type="date" value={toDate} min={fromDate} max={today} onChange={(e) => setToDate(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--mono)', fontSize: 13 }} />
            </div>
            {reportType === 'range' && (
              <>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Department</label>
                  <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--mono)', fontSize: 13, background: 'var(--surface)' }}>
                    <option value="">All departments</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Shift</label>
                  <select value={shift} onChange={(e) => setShift(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--mono)', fontSize: 13, background: 'var(--surface)' }}>
                    <option value="">All shifts</option>
                    <option value="Day">Day</option>
                    <option value="Night">Night</option>
                  </select>
                </div>
              </>
            )}
            {reportType === 'rate' && (
              <>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Shift</label>
                  <select value={shift} onChange={(e) => setShift(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--mono)', fontSize: 13, background: 'var(--surface)' }}>
                    <option value="">All shifts</option>
                    <option value="Day">Day</option>
                    <option value="Night">Night</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Breakdown</label>
                  <select value={rateLevel} onChange={(e) => setRateLevel(e.target.value as 'facility' | 'department')} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--mono)', fontSize: 13, background: 'var(--surface)' }}>
                    <option value="facility">By facility</option>
                    <option value="department">By department</option>
                  </select>
                </div>
              </>
            )}
          </>
        )}

        <button
          onClick={runReport}
          disabled={loading}
          style={{ padding: '9px 20px', background: loading ? 'var(--surface2)' : 'var(--accent)', color: loading ? 'var(--text-3)' : 'var(--accent-text)', border: 'none', borderRadius: 'var(--r)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Running...' : 'Run Report'}
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 6 }} />)}
        </div>
      )}

      {!loading && (reportType === 'range' || reportType === 'daily') && data && (
        data.length > 0 ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-2)' }}>{data.length} rows</span>
              <ExportControls
                onDownloadCSV={() => downloadCSV(data, `${genericRange.base}.csv`)}
                captureRef={genericTableRef}
                pngFilename={reportFilename(genericRange.base, scopeSlug(facility), istDateString(), 'png')}
                meta={{ title: genericRange.label, scope: scopeLabel(facility), range: genericRange.range }}
              />
            </div>
            <div ref={genericTableRef} style={{ overflowX: 'auto', maxHeight: 440 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--mono)' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 3 }}>
                  <tr style={{ background: 'var(--surface2)', borderBottom: '2px solid var(--border)' }}>
                    {Object.keys(data[0]).map((h, hi) => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-2)', fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap', ...(hi === 0 ? { position: 'sticky', left: 0, zIndex: 4, background: 'var(--surface2)' } : {}) }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 200).map((row, i) => {
                    const rowBg = i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)';
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: rowBg }}>
                        {Object.values(row).map((v, j) => (
                          <td key={j} style={{ padding: '7px 10px', whiteSpace: 'nowrap', ...(j === 0 ? { position: 'sticky', left: 0, zIndex: 1, background: rowBg } : {}) }}>{String(v ?? '—')}</td>
                        ))}
                      </tr>
                    );
                  })}
                  {data.length > 200 && (
                    <tr><td colSpan={Object.keys(data[0]).length} style={{ padding: '8px', textAlign: 'center', color: 'var(--text-3)' }}>
                      Showing 200 of {data.length} rows — download CSV for full data
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState />
        )
      )}

      {!loading && reportType === 'pivot' && pivotData && (
        pivotData.rows.length > 0 ? (
          <DeptPivotTable
            rows={pivotData.rows}
            grandTotals={pivotData.grandTotals}
            grandTotal={pivotData.grandTotal}
            facility={facility}
            fromDate={pivotRange.from}
            toDate={pivotRange.to}
          />
        ) : (
          <EmptyState />
        )
      )}

      {!loading && reportType === 'manpower' && manpowerData && (
        <ManpowerSummaryTable data={manpowerData} facility={facility} />
      )}

      {!loading && reportType === 'rate' && rateData && (
        <AttendanceRateTable data={rateData} fromDate={rateRange.from} toDate={rateRange.to} facility={facility} />
      )}
    </div>
  );
}
