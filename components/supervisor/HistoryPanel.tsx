'use client';

import { useState } from 'react';
import HistoryTable from '../history/HistoryTable';
import HistoryMatrix from '../history/HistoryMatrix';
import { ATTENDANCE_STATUSES } from '@/lib/constants';
import { istDateString } from '@/lib/ist';
import type { HistoryRecord } from '@/lib/types';

interface HistoryPanelProps {
  departments: string[];
}

export default function HistoryPanel({ departments }: HistoryPanelProps) {
  const today = istDateString();
  const sevenAgo = istDateString(new Date(Date.now() - 6 * 86400000));

  const [fromDate, setFromDate] = useState(sevenAgo);
  const [toDate, setToDate] = useState(today);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const isMultiDay = fromDate !== toDate;

  async function loadHistory() {
    setLoading(true);
    setRecords([]);
    try {
      const endpoint = isMultiDay ? '/api/attendance/history-range' : '/api/attendance/history';
      // No facility param — the server scopes from the session.
      const params = isMultiDay
        ? `department=${departments[0]}&from_date=${fromDate}&to_date=${toDate}`
        : `department=${departments[0]}&attendance_date=${fromDate}`;

      const res = await fetch(`${endpoint}?${params}`);
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
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>From</label>
          <input type="date" value={fromDate} max={today} onChange={(e) => setFromDate(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--mono)', fontSize: 13 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>To</label>
          <input type="date" value={toDate} min={fromDate} max={today} onChange={(e) => setToDate(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--mono)', fontSize: 13 }} />
        </div>
        <button
          onClick={loadHistory}
          disabled={loading}
          style={{ padding: '9px 20px', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: 'var(--r)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Loading...' : 'View'}
        </button>
      </div>

      {/* Filters */}
      {records.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search employee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, minWidth: 180, padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 13 }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 13, background: 'var(--surface)' }}
          >
            <option value="">All statuses</option>
            {ATTENDANCE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 40, borderRadius: 6 }} />
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && records.length > 0 && isMultiDay && (
        <HistoryMatrix records={records} searchQuery={searchQuery} statusFilter={statusFilter} />
      )}
      {!loading && records.length > 0 && !isMultiDay && (
        <HistoryTable records={records} searchQuery={searchQuery} statusFilter={statusFilter} />
      )}
      {!loading && records.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
          Select a date range and click View
        </div>
      )}
    </div>
  );
}
