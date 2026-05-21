'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import EmployeeRow, { type EmployeeEntry } from './EmployeeRow';
import ProgressBar from './ProgressBar';
import SummaryBar from './SummaryBar';
import SubmissionBanner from './SubmissionBanner';
import Modal from '../shared/Modal';
import { useToast } from '../shared/Toast';
import { istDateString } from '@/lib/ist';
import { formatIST } from '@/lib/formatIST';
import { ATTENDANCE_CUTOFF_HOUR_IST } from '@/lib/constants';

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
  const [selectedDesignations, setSelectedDesignations] = useState<Set<string>>(new Set());
  const [sortByDesignation, setSortByDesignation] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteReason, setRewriteReason] = useState('');
  const { showToast } = useToast();

  // Derived submission/blocking state
  const isPastDate = date < today;
  const isPastCutoff = new Date(Date.now() + 5.5 * 3600000).getUTCHours() >= ATTENDANCE_CUTOFF_HOUR_IST;
  const isRewriteApproved = checkStatus?.request_status === 'approved';
  // Past-date block lifts when a rewrite is approved; cutoff always blocks
  const isBlocked = (isPastDate && !isRewriteApproved) || isPastCutoff;
  const alreadySubmitted = !!checkStatus?.submitted;

  async function loadEmployees() {
    setLoading(true);
    setEmployees([]);
    setSubmitted(false);
    setCheckStatus(null);
    setSelectedDesignations(new Set());
    setSortByDesignation(false);

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

  const designations = useMemo(() => {
    const seen = new Set<string>();
    employees.forEach((e) => { if (e.designation) seen.add(e.designation); });
    return Array.from(seen).sort();
  }, [employees]);

  const filtered = useMemo(() => {
    let result = employees;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) =>
        e.employee_name.toLowerCase().includes(q) ||
        e.employee_code.toLowerCase().includes(q)
      );
    }
    if (selectedDesignations.size > 0) {
      result = result.filter((e) => e.designation && selectedDesignations.has(e.designation));
    }
    if (sortByDesignation) {
      result = [...result].sort((a, b) => {
        const da = a.designation ?? '';
        const db = b.designation ?? '';
        return da.localeCompare(db) || a.employee_name.localeCompare(b.employee_name);
      });
    }
    return result;
  }, [employees, searchQuery, selectedDesignations, sortByDesignation]);

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
      const groups = employees.reduce<Record<string, EmployeeEntry[]>>((acc, e) => {
        const key = `${e.facility}||${e.department}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(e);
        return acc;
      }, {});

      for (const [key, group] of Object.entries(groups)) {
        const [grpFacility, grpDept] = key.split('||');
        const res = await fetch('/api/attendance/submit', {
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
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Submission failed (${res.status})`);
        }
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
    } catch (err: unknown) {
      showToast((err as Error).message || 'Submission failed', 'error');
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

  const warnBannerStyle: React.CSSProperties = {
    background: '#fff8e1',
    border: '1.5px solid var(--warn)',
    borderRadius: 'var(--r)',
    padding: '12px 16px',
    fontFamily: 'var(--mono)',
    fontSize: 13,
    color: 'var(--warn)',
    lineHeight: 1.6,
  };

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

      {/* Blocked warning banner (past date or past cutoff) */}
      {(isPastDate && !isRewriteApproved) && (
        <div style={warnBannerStyle}>
          ⚠ Past date selected. You cannot submit attendance directly for past dates. Use the Rewrite Request tab to request a correction.
        </div>
      )}
      {isPastCutoff && !isPastDate && (
        <div style={warnBannerStyle}>
          ⚠ Attendance submission is closed after {ATTENDANCE_CUTOFF_HOUR_IST}:00 IST. Contact your manager if corrections are needed.
        </div>
      )}

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
          {/* Already-submitted overwrite warning */}
          {alreadySubmitted && (
            <div style={warnBannerStyle}>
              ⚠ Attendance already submitted for {departments[0]} {checkStatus?.shift || shift} on {date}
              {checkStatus?.marked_by ? ` by ${checkStatus.marked_by}` : ''}
              {checkStatus?.marked_at ? ` at ${formatIST(checkStatus.marked_at)}` : ''}. Loading for review only.
            </div>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: 180, padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 13 }}
            />
            {!isBlocked && (
              <>
                <button onClick={() => setAllStatus('Present')} style={{ padding: '7px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer', background: 'var(--surface)' }}>All Present</button>
                <button onClick={() => setAllStatus('Week Off')} style={{ padding: '7px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer', background: 'var(--surface)' }}>All Week Off</button>
              </>
            )}
          </div>

          {/* Designation filter + sort */}
          {designations.length > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                Designation
              </span>
              {designations.map((d) => {
                const active = selectedDesignations.has(d);
                return (
                  <button
                    key={d}
                    onClick={() => {
                      setSelectedDesignations((prev) => {
                        const next = new Set(prev);
                        if (next.has(d)) next.delete(d); else next.add(d);
                        return next;
                      });
                    }}
                    style={{
                      padding: '3px 10px',
                      border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 20,
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      cursor: 'pointer',
                      background: active ? 'var(--accent)' : 'var(--surface)',
                      color: active ? 'var(--accent-text)' : 'var(--text-2)',
                      transition: 'background 0.13s, border-color 0.13s, color 0.13s',
                    }}
                  >
                    {d}
                  </button>
                );
              })}
              {selectedDesignations.size > 0 && (
                <button
                  onClick={() => setSelectedDesignations(new Set())}
                  style={{ padding: '3px 10px', border: '1.5px solid var(--border)', borderRadius: 20, fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', background: 'none', color: 'var(--text-3)' }}
                >
                  ✕ Clear
                </button>
              )}
              <button
                onClick={() => setSortByDesignation((v) => !v)}
                style={{
                  marginLeft: 4,
                  padding: '3px 10px',
                  border: `1.5px solid ${sortByDesignation ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 20,
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  cursor: 'pointer',
                  background: sortByDesignation ? 'rgba(79,70,229,0.08)' : 'var(--surface)',
                  color: sortByDesignation ? 'var(--accent)' : 'var(--text-2)',
                  transition: 'background 0.13s, border-color 0.13s, color 0.13s',
                }}
              >
                ↕ Sort by Designation
              </button>
            </div>
          )}

          <ProgressBar present={presentCount} total={employees.length} />
          <SummaryBar counts={counts} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map((emp) => (
              <EmployeeRow
                key={emp.employee_code}
                employee={emp}
                searchQuery={searchQuery}
                onChange={updateEmployee}
                disabled={isBlocked}
              />
            ))}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
                No employees match your search
              </div>
            )}
          </div>

          {!isBlocked && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                padding: '13px',
                background: submitting
                  ? 'var(--surface2)'
                  : alreadySubmitted
                    ? 'var(--warn)'
                    : 'var(--accent)',
                color: submitting ? 'var(--text-3)' : '#fff',
                border: 'none',
                borderRadius: 'var(--r)',
                fontFamily: 'var(--display)',
                fontWeight: 700,
                fontSize: 15,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting
                ? 'Submitting...'
                : alreadySubmitted
                  ? `Resubmit (Overwrite) — ${employees.length} employees`
                  : `Submit Attendance (${employees.length} employees)`
              }
            </button>
          )}
        </>
      )}

      {!loading && employees.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
          Select a date and click &quot;Load Employees&quot; to begin
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
