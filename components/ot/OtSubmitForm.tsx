'use client';

import { useCallback, useEffect, useState } from 'react';
import { istDateString } from '@/lib/ist';
import { useToast } from '../shared/Toast';

interface OtSubmitFormProps {
  /** Departments this user may pick from. Supervisors get their own; managers get all. */
  departments: string[];
}

interface PickerEmployee {
  employee_code: string;
  employee_name: string;
  department: string;
}

const labelStyle: React.CSSProperties = { display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' };
const fieldStyle: React.CSSProperties = { padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--mono)', fontSize: 13, background: 'var(--surface)', width: '100%' };

export default function OtSubmitForm({ departments }: OtSubmitFormProps) {
  const today = istDateString();
  const [department, setDepartment] = useState(departments[0] ?? '');
  const [employees, setEmployees] = useState<PickerEmployee[]>([]);
  const [employeeCode, setEmployeeCode] = useState('');
  const [otDate, setOtDate] = useState(today);
  const [otHours, setOtHours] = useState('1');
  const [reason, setReason] = useState('');
  const [loadingEmps, setLoadingEmps] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  // The picker is facility-scoped by the SERVER: /api/employees derives the facility
  // filter from the session, so no facility is sent from here.
  const loadEmployees = useCallback(async (dept: string) => {
    if (!dept) return;
    setLoadingEmps(true);
    try {
      const res = await fetch(`/api/employees?department=${encodeURIComponent(dept)}`);
      const data = await res.json();
      setEmployees(data.employees ?? []);
    } catch {
      setEmployees([]);
    } finally {
      setLoadingEmps(false);
    }
  }, []);

  useEffect(() => {
    setEmployeeCode('');
    loadEmployees(department);
  }, [department, loadEmployees]);

  async function submit() {
    if (!employeeCode || !otDate || !reason.trim()) {
      showToast('Employee, OT date and reason are required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      // No facility in the body — the server stamps it from the employee's own row.
      const res = await fetch('/api/ot/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_code: employeeCode,
          ot_date: otDate,
          ot_hours: Number(otHours),
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Submit failed (${res.status})`);
      showToast(`OT request raised for ${otHours}h — pending approval`, 'success');
      setReason('');
      setEmployeeCode('');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to raise OT request', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
      <div>
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18, margin: 0 }}>Raise Overtime</h2>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)', margin: '6px 0 0' }}>
          OT is a separate ledger — it never changes an employee&apos;s attendance status.
        </p>
      </div>

      <div>
        <label style={labelStyle}>Department</label>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} style={fieldStyle}>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Employee</label>
        <select value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} disabled={loadingEmps} style={fieldStyle}>
          <option value="">{loadingEmps ? 'Loading…' : employees.length ? 'Select employee' : 'No employees in this department'}</option>
          {employees.map((e) => (
            <option key={e.employee_code} value={e.employee_code}>{e.employee_name} · {e.employee_code}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>OT Date</label>
          <input type="date" value={otDate} max={today} onChange={(e) => setOtDate(e.target.value)} style={fieldStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Hours</label>
          {/* step/min/max mirror the ot_requests CHECK constraint. */}
          <input type="number" value={otHours} min={0.5} max={24} step={0.5} onChange={(e) => setOtHours(e.target.value)} style={fieldStyle} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Reason</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Why was this overtime worked?" style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'var(--mono)' }} />
      </div>

      <button
        onClick={submit}
        disabled={submitting || !employeeCode}
        style={{ padding: '10px 20px', background: submitting || !employeeCode ? 'var(--surface2)' : 'var(--accent)', color: submitting || !employeeCode ? 'var(--text-3)' : 'var(--accent-text)', border: 'none', borderRadius: 'var(--r)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, cursor: submitting || !employeeCode ? 'not-allowed' : 'pointer', alignSelf: 'flex-start' }}
      >
        {submitting ? 'Submitting…' : 'Submit OT Request'}
      </button>
    </div>
  );
}
