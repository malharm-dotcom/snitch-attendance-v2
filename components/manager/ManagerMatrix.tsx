'use client';

import { useMemo, useState } from 'react';
import HistoryMatrix from '../history/HistoryMatrix';
import { istDateString } from '@/lib/ist';
import { DEPARTMENTS } from '@/lib/constants';
import { normalizeRollType, NOT_SPECIFIED } from '@/lib/reporting';
import type { HistoryRecord } from '@/lib/types';

const ALL_DEPTS = '__all__';

/** Same field styling as the Department dropdown / the Reports shift control. */
const selectStyle: React.CSSProperties = { padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--mono)', fontSize: 13, background: 'var(--surface)' };
const labelStyle: React.CSSProperties = { display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' };

/** Distinct values in the loaded rows, sorted, with "Not specified" pinned last. */
function distinct(values: string[]): string[] {
  const set = new Set(values.filter(Boolean));
  const out = Array.from(set).sort();
  return [...out.filter((v) => v !== NOT_SPECIFIED), ...out.filter((v) => v === NOT_SPECIFIED)];
}

interface ManagerMatrixProps {
  /** Mirrors the Topbar condition — only an all-access session sees a facility control. */
  allFacilities?: boolean;
}

export default function ManagerMatrix({ allFacilities = false }: ManagerMatrixProps) {
  const today = istDateString();
  const sevenAgo = istDateString(new Date(Date.now() - 6 * 86400000));

  const [fromDate, setFromDate] = useState(sevenAgo);
  const [toDate, setToDate] = useState(today);
  const [department, setDepartment] = useState(ALL_DEPTS);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [rollTypeFilter, setRollTypeFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('');

  // Options come from the rows already on screen — no extra endpoint, and the list can
  // never offer a facility outside the session's server-derived scope.
  const rollTypeOptions = useMemo(
    () => distinct(records.map((r) => normalizeRollType(r.ROLL_TYPE))),
    [records]
  );
  const facilityOptions = useMemo(
    () => distinct(records.map((r) => r.FACILITY ?? '')),
    [records]
  );

  async function load() {
    if (!department && department !== ALL_DEPTS) return;
    setLoading(true);
    try {
      // No facility param — the server scopes from the session.
      const res = await fetch(
        `/api/attendance/history-range?department=${encodeURIComponent(department)}&from_date=${fromDate}&to_date=${toDate}`
      );
      const data = await res.json();
      setRecords(data.records ?? []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Department</label>
          <select value={department} onChange={(e) => setDepartment(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--mono)', fontSize: 13, background: 'var(--surface)' }}>
            <option value="">Select department</option>
            <option value={ALL_DEPTS}>All departments</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Roll Type</label>
          <select value={rollTypeFilter} onChange={(e) => setRollTypeFilter(e.target.value)} style={selectStyle}>
            <option value="">All roll types</option>
            {rollTypeOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Shift</label>
          <select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)} style={selectStyle}>
            <option value="">All shifts</option>
            <option value="Day">Day</option>
            <option value="Night">Night</option>
          </select>
        </div>
        {allFacilities && (
          <div>
            <label style={labelStyle}>Facility</label>
            <select value={facilityFilter} onChange={(e) => setFacilityFilter(e.target.value)} style={selectStyle}>
              <option value="">All facilities</option>
              {facilityOptions.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        )}
        <div>
          <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>From</label>
          <input type="date" value={fromDate} max={today} onChange={(e) => setFromDate(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--mono)', fontSize: 13 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>To</label>
          <input type="date" value={toDate} min={fromDate} max={today} onChange={(e) => setToDate(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--mono)', fontSize: 13 }} />
        </div>
        <button
          onClick={load}
          disabled={loading || !department}
          style={{ padding: '9px 20px', background: !department ? 'var(--surface2)' : 'var(--accent)', color: !department ? 'var(--text-3)' : 'var(--accent-text)', border: 'none', borderRadius: 'var(--r)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, cursor: !department ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
        >
          {loading ? 'Loading...' : 'View'}
        </button>
      </div>

      {records.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input type="text" placeholder="Search employee..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: 1, minWidth: 160, padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 13 }} />
          <input type="text" placeholder="Status filter..." value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 160, padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 13 }} />
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 6 }} />)}
        </div>
      )}

      {!loading && records.length > 0 && (
        <HistoryMatrix records={records} searchQuery={searchQuery} statusFilter={statusFilter} rollTypeFilter={rollTypeFilter} shiftFilter={shiftFilter} facilityFilter={facilityFilter} fromDate={fromDate} toDate={toDate} showSummary showPayrollDates />
      )}

      {!loading && records.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
          Select a department and date range, then click View
        </div>
      )}
    </div>
  );
}
