'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import EmployeeRow, { type EmployeeEntry } from './EmployeeRow';
import { buildDayColumns, HistoryStripHeader } from './HistoryStrip';
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
  // Per-employee rewrite data. null means legacy: a NULL-code approved row unlocks all.
  approved_employee_codes: string[] | null;
  legacy_all_approved: boolean;
  rewrite_summary: Record<string, number> | null;
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
  const [selectedForRewrite, setSelectedForRewrite] = useState<Set<string>>(new Set());
  const [confirmFilterOpen, setConfirmFilterOpen] = useState(false);
  // 7-day read-only history strip: code -> { 'YYYY-MM-DD': status }. Never blocks marking UI.
  const [stripData, setStripData] = useState<Record<string, Record<string, string>>>({});
  const [stripLoading, setStripLoading] = useState(false);
  const { showToast } = useToast();

  // The 7 day-columns ending the day BEFORE the selected date, oldest → newest.
  // Single source of column order shared by the sticky header and every employee row.
  const dayColumns = useMemo(() => buildDayColumns(date), [date]);

  const designationFilterActive = selectedDesignations.size > 0;
  const activeDesignationNames = Array.from(selectedDesignations).join(', ');

  // Per-employee approval state
  const approvedCodes = useMemo(
    () => new Set(checkStatus?.approved_employee_codes ?? []),
    [checkStatus],
  );
  const legacyAllApproved = checkStatus?.legacy_all_approved === true;

  const isPastDate = date < today;
  const isPastCutoff = new Date(Date.now() + 5.5 * 3600000).getUTCHours() >= ATTENDANCE_CUTOFF_HOUR_IST;
  const alreadySubmitted = !!checkStatus?.submitted;

  function isEmployeeBlocked(code: string): boolean {
    if (isPastCutoff) return true;
    if (!isPastDate) return false;
    if (legacyAllApproved) return false;
    return !approvedCodes.has(code);
  }

  const someApproved = legacyAllApproved || approvedCodes.size > 0;
  // True if at least one employee can be edited (gates submit button + bulk controls)
  const anyUnlocked = !isPastCutoff && (!isPastDate || someApproved);

  async function loadEmployees() {
    setLoading(true);
    setEmployees([]);
    setSubmitted(false);
    setCheckStatus(null);
    setSelectedDesignations(new Set());
    setSortByDesignation(false);
    setStripData({});

    try {
      const [empRes, checkRes] = await Promise.all([
        fetch(`/api/employees?facility=${facility}&departments=${departments.join(',')}&shift=${shift}&date=${date}`),
        fetch(`/api/attendance/check?facility=${facility}&department=${departments[0]}&attendance_date=${date}&shift=${shift}`),
      ]);

      const empData = await empRes.json();
      const checkData = await checkRes.json();

      const loaded: EmployeeEntry[] = (empData.employees ?? []).map((e: EmployeeEntry & { existing_status?: string | null; existing_remarks?: string | null }) => ({
        ...e,
        attendance_status: e.existing_status ?? 'Present',
        remarks: e.existing_remarks ?? '',
      }));

      setEmployees(loaded);
      setCheckStatus(checkData);
      if (checkData.submitted) setSubmitted(true);

      // Fetch the 7-day history strip in the background — never block the marking UI on it.
      loadHistoryStrip(loaded.map((e) => e.employee_code));
    } catch {
      showToast('Failed to load employees', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadHistoryStrip(codes: string[]) {
    if (codes.length === 0) return;
    setStripLoading(true);
    try {
      const res = await fetch(
        `/api/attendance/history-strip?attendance_date=${date}&employee_codes=${encodeURIComponent(codes.join(','))}`,
      );
      if (!res.ok) return; // strip is best-effort; silently skip on failure
      const json = await res.json();
      setStripData(json.strip ?? {});
    } catch {
      // Non-fatal: leave strip empty (cells render faint dashes)
    } finally {
      setStripLoading(false);
    }
  }

  useEffect(() => {
    if (prevShiftRef.current !== shift && employees.length > 0) {
      loadEmployees();
    }
    prevShiftRef.current = shift;
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
        approved_employee_codes: [],
        legacy_all_approved: false,
        rewrite_summary: null,
      });
      showToast('Attendance submitted!', 'success');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Submission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function openRewriteModal() {
    setSelectedForRewrite(new Set());
    setRewriteReason('');
    setRewriteOpen(true);
  }

  async function handleRewriteSubmit() {
    if (!rewriteReason.trim() || selectedForRewrite.size === 0) return;
    try {
      const res = await fetch('/api/rewrite/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendance_date: date,
          facility,
          department: departments[0],
          supervisor_name: supervisorName,
          reason: rewriteReason,
          employee_codes: Array.from(selectedForRewrite),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Request failed');

      setRewriteOpen(false);
      setRewriteReason('');
      setSelectedForRewrite(new Set());

      // Reload check status to reflect updated per-employee summary
      const checkRes = await fetch(
        `/api/attendance/check?facility=${facility}&department=${departments[0]}&attendance_date=${date}&shift=${shift}`
      );
      const checkData = await checkRes.json();
      setCheckStatus(checkData);

      showToast('Edit request submitted', 'success');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to submit request', 'error');
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

  // Rewrite employee list (only employees currently loaded, for the modal)
  const rewriteEmployeeList = employees;
  const allRewriteSelected = rewriteEmployeeList.length > 0 &&
    rewriteEmployeeList.every((e) => selectedForRewrite.has(e.employee_code));

  function toggleAllRewrite() {
    if (allRewriteSelected) {
      setSelectedForRewrite(new Set());
    } else {
      setSelectedForRewrite(new Set(rewriteEmployeeList.map((e) => e.employee_code)));
    }
  }

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

      {/* Past-date warning — shown when no employees are approved yet */}
      {isPastDate && !legacyAllApproved && employees.length === 0 && (
        <div style={warnBannerStyle}>
          ⚠ Past date selected. You cannot submit attendance directly for past dates. Use the &quot;Request Edit&quot; button after loading employees to request a correction for specific employees.
        </div>
      )}
      {isPastDate && !legacyAllApproved && employees.length > 0 && !someApproved && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ ...warnBannerStyle, flex: 1 }}>
            ⚠ Past date — all employees are locked. Use &quot;Request Edit&quot; to select specific employees for a rewrite request.
          </div>
          <button
            onClick={openRewriteModal}
            style={{
              padding: '10px 20px',
              background: 'var(--accent)',
              color: 'var(--accent-text)',
              border: 'none',
              borderRadius: 'var(--r)',
              fontFamily: 'var(--display)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Request Edit
          </button>
        </div>
      )}
      {isPastDate && !legacyAllApproved && employees.length > 0 && someApproved && (
        <div style={warnBannerStyle}>
          ⚠ Past date — {approvedCodes.size} employee{approvedCodes.size !== 1 ? 's' : ''} approved for rewrite. Others remain locked.
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
          rewriteSummary={checkStatus.rewrite_summary}
          onRequestRewrite={openRewriteModal}
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
            {/* Bulk status buttons only available when not a past date (avoids confusion with mixed locked states) */}
            {!isPastDate && !isPastCutoff && (
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

          {/* Sticky date header — aligns above every card's 7-day cells (spreadsheet-style) */}
          <HistoryStripHeader days={dayColumns} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map((emp) => (
              <EmployeeRow
                key={emp.employee_code}
                employee={emp}
                searchQuery={searchQuery}
                onChange={updateEmployee}
                disabled={isEmployeeBlocked(emp.employee_code)}
                stripDays={dayColumns}
                stripStatuses={stripData[emp.employee_code]}
                stripLoading={stripLoading}
              />
            ))}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
                No employees match your search
              </div>
            )}
          </div>

          {/* Submit button — visible when at least one employee is unlocked */}
          {anyUnlocked && (!alreadySubmitted || someApproved) && (
            <>
              {designationFilterActive && (
                <div style={{ ...warnBannerStyle, fontSize: 12 }}>
                  ⚠ Designation filter active — showing {filtered.length} of {employees.length} employees.
                  {' '}Submitting will mark attendance for all {employees.length} employees in this department,
                  including those not visible.
                </div>
              )}

              <button
                onClick={designationFilterActive ? () => setConfirmFilterOpen(true) : handleSubmit}
                disabled={submitting}
                style={{
                  padding: '13px',
                  background: submitting ? 'var(--surface2)' : 'var(--accent)',
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
                  : (alreadySubmitted && someApproved)
                    ? 'Resubmit Attendance'
                    : designationFilterActive
                      ? `Submit All ${employees.length} Employees`
                      : `Submit Attendance (${employees.length} employees)`
                }
              </button>
            </>
          )}
        </>
      )}

      {!loading && employees.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
          Select a date and click &quot;Load Employees&quot; to begin
        </div>
      )}

      {/* Designation-filter confirmation modal */}
      <Modal
        open={confirmFilterOpen}
        onClose={() => setConfirmFilterOpen(false)}
        title="Submit attendance for all employees?"
        actions={
          <>
            <button
              onClick={() => setConfirmFilterOpen(false)}
              style={{ padding: '8px 16px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'none', fontFamily: 'var(--mono)', fontSize: 13, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={() => { setConfirmFilterOpen(false); handleSubmit(); }}
              style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: 'var(--accent-text)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              Submit All {employees.length} Employees
            </button>
          </>
        }
      >
        <p style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.7 }}>
          You are viewing <strong>{filtered.length}</strong> employees filtered by{' '}
          <strong>{activeDesignationNames}</strong>. Submitting will include all{' '}
          <strong>{employees.length}</strong> employees in <strong>{departments[0]}</strong>.
          Employees not visible will be submitted with their currently assigned status.
        </p>
      </Modal>

      {/* Rewrite modal — per-employee selection */}
      <Modal
        open={rewriteOpen}
        onClose={() => setRewriteOpen(false)}
        title="Request Attendance Edit"
        actions={
          <>
            <button
              onClick={() => setRewriteOpen(false)}
              style={{ padding: '8px 16px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'none', fontFamily: 'var(--mono)', fontSize: 13, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleRewriteSubmit}
              disabled={selectedForRewrite.size === 0 || !rewriteReason.trim()}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: 8,
                background: selectedForRewrite.size === 0 || !rewriteReason.trim() ? 'var(--surface2)' : 'var(--accent)',
                color: selectedForRewrite.size === 0 || !rewriteReason.trim() ? 'var(--text-3)' : 'var(--accent-text)',
                fontFamily: 'var(--display)',
                fontWeight: 700,
                fontSize: 13,
                cursor: selectedForRewrite.size === 0 || !rewriteReason.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              Submit Request{selectedForRewrite.size > 0 ? ` (${selectedForRewrite.size})` : ''}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Employee selection */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Select employees
              </span>
              <button
                onClick={toggleAllRewrite}
                style={{ padding: '3px 10px', border: '1.5px solid var(--border)', borderRadius: 20, fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', background: 'none', color: 'var(--text-2)' }}
              >
                {allRewriteSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, border: '1.5px solid var(--border)', borderRadius: 8, padding: '6px 8px' }}>
              {rewriteEmployeeList.map((emp) => (
                <label
                  key={emp.employee_code}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px', cursor: 'pointer', borderRadius: 6, transition: 'background 0.1s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
                >
                  <input
                    type="checkbox"
                    checked={selectedForRewrite.has(emp.employee_code)}
                    onChange={() => {
                      setSelectedForRewrite((prev) => {
                        const next = new Set(prev);
                        if (next.has(emp.employee_code)) next.delete(emp.employee_code);
                        else next.add(emp.employee_code);
                        return next;
                      });
                    }}
                    style={{ width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {emp.employee_name}
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)' }}>
                      {emp.employee_code}{emp.designation ? ` · ${emp.designation}` : ''}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              Reason for edit request
            </label>
            <textarea
              value={rewriteReason}
              onChange={(e) => setRewriteReason(e.target.value)}
              placeholder="Explain why these employees' attendance needs to be corrected..."
              rows={3}
              style={{ width: '100%', padding: '10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 13, resize: 'vertical' }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
