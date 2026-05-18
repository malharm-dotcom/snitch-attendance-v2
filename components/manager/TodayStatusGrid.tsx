'use client';

import { useState, useEffect } from 'react';
import DeptCard from './DeptCard';
import { DEPARTMENTS } from '@/lib/constants';
import { istDateString } from '@/lib/ist';
import Modal from '../shared/Modal';
import HistoryTable from '../history/HistoryTable';
import type { HistoryRecord } from '@/lib/types';

interface Submission {
  facility: string;
  department: string;
  marked_by: string;
  marked_at: string;
  shift: string | null;
}

interface TodayStatusGridProps {
  facility: string;
}

export default function TodayStatusGrid({ facility }: TodayStatusGridProps) {
  const today = istDateString();
  const [date, setDate] = useState(today);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
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
    } catch {
      setSubmissions([]);
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
      const res = await fetch(`/api/attendance/history?facility=${facility}&department=${dept}&attendance_date=${date}`);
      const data = await res.json();
      setDetailRecords(data.records ?? []);
    } catch {
      setDetailRecords([]);
    }
  }

  const submissionMap = new Map(submissions.map((s) => [`${s.facility}|${s.department}`, s]));

  const submitted = submissions.length;
  const total = DEPARTMENTS.length;
  const pending = total - submitted;

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
          {DEPARTMENTS.map((dept) => {
            const sub = submissions.find((s) => s.department === dept) ?? null;
            return (
              <DeptCard
                key={dept}
                facility={facility}
                department={dept}
                submission={sub}
                onClick={() => openDetail(dept)}
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
