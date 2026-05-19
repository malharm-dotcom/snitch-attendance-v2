'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import EmployeeRow, { type EmployeeEntry } from './EmployeeRow';
import ProgressBar from './ProgressBar';
import SummaryBar from './SummaryBar';
import SubmissionBanner from './SubmissionBanner';
import Modal from '../shared/Modal';
import { useToast } from '../shared/Toast';
import { istDateString } from '@/lib/ist';

interface CheckStatus {
  submitted: boolean;
  marked_by: string | null;
  marked_at: string | null;
  request_status: string | null;
  shift: string | null;
}

interface MarkAttendanceProps {
  supervisorName: string;
  facility: string;
  departments: string[];
  shift: 'Day' | 'Night';
}

export default function MarkAttendance({ supervisorName, facility, departments, shift }: MarkAttendanceProps) {
  const today = istDateString();
  const [date, setDate] = useState(today);
  const [employees, setEmployees] = useState<EmployeeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const prevShiftRef = useRef(shift);
  const [checkStatus, setCheckStatus] = useState<CheckStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteReason, setRewriteReason] = useState('');
  const { showToast } = useToast();

  async function loadEmployees() {
    setLoading(true);
    setEmployees([]);
    setSubmitted(false);
    setCheckStatus(null);

    try {
      const [empRes, checkRes] = await Promise.all([
        fetch(`/api/employees?facility=${facility}&departments=${departments.join(',')}&shift=${shift}`),
        fetch(`/api/attendance/check?facility=${facility}&department=${departments[0]}&attendance_date=${date}&shift=${shift}`),
      ]);

      const empData = await empRes.json();
      const checkData = await checkRes.json();

      const loaded: EmployeeEntry[] = (empData.employees ?? []).map((e: EmployeeEntry) => ({
        ...e,
        attendance_status: 'Present',
        remarks: '',
      }));

      setEmployees(loaded);
      setCheckStatus(checkData);
      if (checkData.submitted) setSubmitted(true);
    } catch {
      showToast('Failed to load employees', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Auto-reload when shift changes if employees are already on screen
  useEffect(() => {
    if (prevShiftRef.current !== shift && employees.length > 0) {
      loadEmployees();
    }
    prevShiftRef.current = shift;
  // loadEmployees intentionally omitted — it's stable per render, shift is the trigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift]);

  const updateEmployee = useCallback((code: string, field: 'attendance_status' | 'remarks', value: string) => {
    setEmployees((prev) =>
      prev.map((e) => e.employee_code === code ? { ...e, [field]: value } : e)
    );
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase();
    return employees.filter((e) =>
      e.employee_name.toLowerCase().includes(q) ||
      e.employee_code.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  const counts = useMemo(() => {
    return employees.reduce<Record<string, number>>((acc, e) => {
      acc[e.attendance_status] = (acc[e.attendance_status] ?? 0) + 1;
      return acc;
    }, {});
  }, [employees]);

  const presentCount = counts['Present'] ?? 0;

  function setAllStatus(status: string) {
    setEmployees((prev) => prev.map((e) => ({ ...e, attendance_status: status })));
  }

  async function handleSubmit() {
    if (!employees.length) return;
    setSubmitting(true);
    showToast(`Submitting ${employees.length} employees...`, 'info');

    try {
      // Group by facility+department for multi-dept supervisors
      const groups = employees.reduce<Record<string, EmployeeEntry[]>>((acc, e) => {
        const key = `${e.facility}||${e.department}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(e);
        return acc;
      }, {});

      for (const [key, group] of Object.entries(groups)) {
        const [grpFacility, grpDept] = key.split('||');
        await fetch('/api/attendance/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attendance_date: date,
            facility: grpFacility,
            department: grpDept,
            marked_by: supervisorName,
            shift,
            employees: group.map((e) => ({
              employee_id: e.id,
              employee_code: e.employee_code,
              employee_name: e.employee_name,
              attendance_status: e.attendance_status,
              remarks: e.remarks,
            })),
          }),
        });
      }

      setSubmitted(true);
      setCheckStatus({
        submitted: true,
        marked_by: supervisorName,
        marked_at: new Date().toISOString(),
        request_status: null,
        shift,
      });
      showToast('Attendance submitted!', 'success');
    } catch {
      showToast('Submission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRewriteSubmit() {
    if (!rewriteReason.trim()) return;
    try {
      await fetch('/api/rewrite/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendance_date: date,
          facility,
          department: departments[0],
          supervisor_name: supervisorName,
          reason: rewriteReason,
        }),
      });
      setRewriteOpen(false);
      setRewriteReason('');
      setCheckStatus((prev) => prev ? { ...prev, request_status: 'pending' } : prev);
      showToast('Edit request submitted', 'success');
    } catch {
      showToast('Failed to submit request', 'error');
    }
  }

  const isLocked = checkStatus?.submitted && checkStatus.request_status !== 'approved';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Date + load */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Date
          </label>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => { setDate(e.target.value); setEmployees([]); setCheckStatus(null); setSubmitted(false); }}
            style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--mono)', fontSize: 13 }}
          />
        </div>
        <button
          onClick={loadEmployees}
          disabled={loading}
          style={{
            padding: '9px 20px',
            background: 'var(--accent)',
            color: 'var(--accent-text)',
            border: 'none',
            borderRadius: 'var(--r)',
            fontFamily: 'var(--display)',
            fontWeight: 700,
            fontSize: 13,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Loading...' : 'Load Employees'}
        </button>
      </div>

      {/* Submission banner */}
      {checkStatus?.submitted && (
        <SubmissionBanner
          markedBy={checkStatus.marked_by!}
          markedAt={checkStatus.marked_at!}
          requestStatus={checkStatus.request_status}
          onRequestRewrite={() => setRewriteOpen(true)}
        />
      )}

      {/* Employee list */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 62, borderRadius: 'var(--r)' }} />
          ))}
        </div>
      )}

      {!loading && employees.length > 0 && (
        <>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: 180, padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 13 }}
            />
            {!isLocked && (
              <>
                <button onClick={() => setAllStatus('Present')} style={{ padding: '7px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer', background: 'var(--surface)' }}>All Present</button>
                <button onClick={() => setAllStatus('Week Off')} style={{ padding: '7px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer', background: 'var(--surface)' }}>All Week Off</button>
              </>
            )}
          </div>

          <ProgressBar present={presentCount} total={employees.length} />
          <SummaryBar counts={counts} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map((emp) => (
              <EmployeeRow
                key={emp.employee_code}
                employee={emp}
                searchQuery={searchQuery}
                onChange={updateEmployee}
                disabled={!!isLocked}
              />
            ))}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
                No employees match your search
              </div>
            )}
          </div>

          {!isLocked && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                padding: '13px',
                background: submitting ? 'var(--surface2)' : 'var(--accent)',
                color: submitting ? 'var(--text-3)' : 'var(--accent-text)',
                border: 'none',
                borderRadius: 'var(--r)',
                fontFamily: 'var(--display)',
                fontWeight: 700,
                fontSize: 15,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Submitting...' : `Submit Attendance (${employees.length} employees)`}
            </button>
          )}
        </>
      )}

      {!loading && employees.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
          Select a date and click "Load Employees" to begin
        </div>
      )}

      {/* Rewrite modal */}
      <Modal
        open={rewriteOpen}
        onClose={() => setRewriteOpen(false)}
        title="Request Attendance Edit"
        actions={
          <>
            <button onClick={() => setRewriteOpen(false)} style={{ padding: '8px 16px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'none', fontFamily: 'var(--mono)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleRewriteSubmit} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: 'var(--accent-text)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Submit Request</button>
          </>
        }
      >
        <p style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-2)', marginTop: 0 }}>
          Explain why you need to edit attendance for {date}:
        </p>
        <textarea
          value={rewriteReason}
          onChange={(e) => setRewriteReason(e.target.value)}
          placeholder="Reason for edit request..."
          rows={4}
          style={{ width: '100%', padding: '10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 13, resize: 'vertical' }}
          autoFocus
        />
      </Modal>
    </div>
  );
}
