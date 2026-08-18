'use client';

import { useState, useEffect } from 'react';
import DeptCard from './DeptCard';
import { DEPARTMENTS } from '@/lib/constants';
import { istDateString } from '@/lib/ist';
import Modal from '../shared/Modal';
import HistoryTable from '../history/HistoryTable';
import type { HistoryRecord } from '@/lib/types';
import { ALL_FACILITIES } from '@/lib/reportExport';

interface Submission {
  facility: string;
  department: string;
  marked_by: string;
  marked_at: string;
  shift: string | null;
}

interface DeptCount {
  department: string;
  count: number;
}

interface TodayStatusGridProps {
  facility: string;
}

type ShiftFilter = 'All' | 'Day' | 'Night';

export default function TodayStatusGrid({ facility }: TodayStatusGridProps) {
  const today = istDateString();
  const [date, setDate] = useState(today);
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('All');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [deptCounts, setDeptCounts] = useState<DeptCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailDept, setDetailDept] = useState<string | null>(null);
  const [detailRecords, setDetailRecords] = useState<HistoryRecord[]>([]);

  useEffect(() => {
    loadStatus();
  }, [date]);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch(`/api/today-status?attendance_date=${date}`);
      const data = await res.json();
      setSubmissions(data.submissions ?? []);
      setDeptCounts(data.deptCounts ?? []);
    } catch {
      setSubmissions([]);
      setDeptCounts([]);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(dept: string) {
    setDetailDept(dept);
    setDetailOpen(true);
    const sub = submissions.find((s) => s.department === dept);
    if (!sub) return;
    try {
      // No facility param — the server scopes from the session.
      const res = await fetch(`/api/attendance/history?department=${dept}&attendance_date=${date}`);
      const data = await res.json();
      setDetailRecords(data.records ?? []);
    } catch {
      setDetailRecords([]);
    }
  }

  // The daily grid is a per-facility operational view: one card per department, showing
  // whether THAT facility submitted. Across three facilities a department has up to three
  // different answers and a single card cannot show them, so the aggregate is not offered
  // here — Employee View and Reports both handle cross-facility scope correctly.
  if (facility === ALL_FACILITIES) {
    return (
      <div style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--accent)',
        borderRadius: 'var(--r)',
        padding: '14px 18px',
        fontFamily: 'var(--mono)',
        fontSize: 13,
        color: 'var(--text-2)',
        lineHeight: 1.6,
      }}>
        <strong style={{ color: 'var(--text)' }}>Select a specific facility for the Daily view.</strong>
        <br />
        Each card answers &ldquo;has this department submitted?&rdquo; — a question with a
        different answer per facility. Use <strong>Employee View</strong> or the{' '}
        <strong>Reports</strong> tab for cross-facility data.
      </div>
    );
  }

  const submissionMap = new Map(submissions.map((s) => [`${s.facility}|${s.department}`, s]));
  const employeeCountMap = new Map(deptCounts.map((d) => [d.department, d.count]));

  const activeDepts = DEPARTMENTS.filter((dept) => (employeeCountMap.get(dept) ?? 0) > 0);
  const submitted = activeDepts.filter((dept) => submissions.some((s) => s.department === dept)).length;
  const pending = activeDepts.length - submitted;

  const visibleDepts = shiftFilter === 'All'
    ? DEPARTMENTS
    : DEPARTMENTS.filter((dept) => {
        const sub = submissions.find((s) => s.department === dept);
        return !sub || sub.shift === shiftFilter || sub.shift === null;
      });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--mono)', fontSize: 13 }}
        />
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface2)', borderRadius: 20, padding: 3 }}>
          {(['All', 'Day', 'Night'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setShiftFilter(s)}
              style={{
                padding: '5px 14px',
                border: 'none',
                borderRadius: 20,
                fontFamily: 'var(--mono)',
                fontSize: 12,
                cursor: 'pointer',
                background: shiftFilter === s ? 'var(--text)' : 'transparent',
                color: shiftFilter === s ? '#fff' : 'var(--text-2)',
                transition: 'all 0.15s',
              }}
            >
              {s === 'Day' ? '☀ Day' : s === 'Night' ? '🌙 Night' : 'All'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, fontFamily: 'var(--mono)', fontSize: 13 }}>
          <span style={{ color: 'var(--success)', fontWeight: 600 }}>{submitted} submitted</span>
          <span style={{ color: 'var(--text-3)' }}>·</span>
          <span style={{ color: 'var(--warn)' }}>{pending} pending</span>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {[...Array(9)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--r)' }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {visibleDepts.map((dept) => {
            const sub = submissions.find((s) => s.department === dept) ?? null;
            const hasEmployees = (employeeCountMap.get(dept) ?? 0) > 0;
            return (
              <DeptCard
                key={dept}
                facility={facility}
                department={dept}
                submission={sub}
                hasEmployees={hasEmployees}
                onClick={() => openDetail(dept)}
                attendanceDate={date}
              />
            );
          })}
        </div>
      )}

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={`${detailDept} — ${date}`}
        width={700}
      >
        <HistoryTable
          records={detailRecords}
          searchQuery=""
          statusFilter=""
        />
      </Modal>
    </div>
  );
}
