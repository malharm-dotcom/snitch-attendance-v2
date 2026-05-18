'use client';

import { useState } from 'react';
import HistoryMatrix from '../history/HistoryMatrix';
import { istDateString } from '@/lib/ist';
import { DEPARTMENTS } from '@/lib/constants';
import type { HistoryRecord } from '@/lib/types';

interface ManagerMatrixProps {
  facility: string;
}

export default function ManagerMatrix({ facility }: ManagerMatrixProps) {
  const today = istDateString();
  const sevenAgo = istDateString(new Date(Date.now() - 6 * 86400000));

  const [fromDate, setFromDate] = useState(sevenAgo);
  const [toDate, setToDate] = useState(today);
  const [department, setDepartment] = useState('');
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    if (!department) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/attendance/history-range?facility=${facility}&department=${encodeURIComponent(department)}&from_date=${fromDate}&to_date=${toDate}`
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
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
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
          style={{ padding: '9px 20px', background: !department ? 'var(--surface2)' : 'var(--accent)', color: !department ? 'var(--text-3)' : 'var(--accent-text)', border: 'none', borderRadius: 'var(--r)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, cursor: !department ? 'not-allowed' : 'pointer' }}
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
        <HistoryMatrix records={records} searchQuery={searchQuery} statusFilter={statusFilter} />
      )}

      {!loading && records.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
          Select a department and date range, then click View
        </div>
      )}
    </div>
  );
}
