'use client';

import { useState, useEffect, useCallback } from 'react';
import { DEPARTMENTS } from '@/lib/constants';
import { useToast } from '../shared/Toast';

interface EmployeeRow {
  id: number;
  employeeCode: string;
  employeeName: string;
  facility: string;
  department: string;
  shift: string | null;
  designation: string | null;
  reportingManager: string | null;
  rollType: string | null;
  gender: string | null;
  isActive: boolean;
}

interface EditForm {
  employeeCode: string;
  employeeName: string;
  facility: string;
  department: string;
  designation: string;
  shift: string;
  isActive: boolean;
  rollType: string;
  gender: string;
  reportingManager: string;
}

const SHIFTS = ['Day', 'Night'];
const ROLL_TYPES = ['On-Roll', 'Off-Roll'];
const GENDERS = ['Male', 'Female', 'Other'];

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--mono)',
  fontSize: 11,
  color: 'var(--text-2)',
  marginBottom: 5,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1.5px solid var(--border)',
  borderRadius: 8,
  fontFamily: 'var(--mono)',
  fontSize: 13,
  background: 'var(--surface)',
  color: 'var(--text)',
  outline: 'none',
  transition: 'border-color 0.15s',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export default function EmployeesTab() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [currentFacility, setCurrentFacility] = useState('');
  const [isSouthAdmin, setIsSouthAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/employees');
      const data = await res.json();
      setEmployees(data.employees ?? []);
      setCurrentFacility(data.currentFacility ?? '');
      setIsSouthAdmin(data.isSouthAdmin ?? false);
    } catch {
      showToast('Failed to load employees', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function openEdit(emp: EmployeeRow) {
    setEditForm({
      employeeCode: emp.employeeCode,
      employeeName: emp.employeeName,
      facility: emp.facility,
      department: emp.department,
      designation: emp.designation ?? '',
      shift: emp.shift ?? '',
      isActive: emp.isActive,
      rollType: emp.rollType ?? '',
      gender: emp.gender ?? '',
      reportingManager: emp.reportingManager ?? '',
    });
  }

  async function saveEdit() {
    if (!editForm) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_code: editForm.employeeCode,
          employee_name: editForm.employeeName,
          facility: editForm.facility,
          department: editForm.department,
          designation: editForm.designation || null,
          shift: editForm.shift || null,
          is_active: editForm.isActive,
          roll_type: editForm.rollType || null,
          gender: editForm.gender || null,
          reporting_manager: editForm.reportingManager || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('Employee updated', 'success');
      setEditForm(null);
      load();
    } catch (err: unknown) {
      showToast((err as Error).message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  const query = search.trim().toLowerCase();
  const displayed = employees.filter((e) => {
    if (!query) return true;
    return (
      e.employeeCode.toLowerCase().includes(query) ||
      e.employeeName.toLowerCase().includes(query)
    );
  });

  const COLUMNS = ['Code', 'Name', 'Facility', 'Department', 'Designation', 'Shift', 'Roll Type', 'Gender', 'Status', ''];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18, margin: 0 }}>
          Employees
          {!loading && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-3)', fontWeight: 400, marginLeft: 8 }}>
              {employees.length} total
            </span>
          )}
        </h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {currentFacility && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '4px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text-2)' }}>
              {currentFacility}
            </span>
          )}
        </div>
      </div>

      {/* Search bar */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or employee code…"
        style={{ ...inputStyle, maxWidth: 360 }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
      />

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />
          ))}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--mono)' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '2px solid var(--border)' }}>
                {COLUMNS.map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', color: 'var(--text-2)', whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((e) => (
                <tr
                  key={e.id}
                  style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                  onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.background = 'var(--surface2)'; }}
                  onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.background = ''; }}
                >
                  <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>{e.employeeCode}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--display)', fontWeight: 600 }}>{e.employeeName}</td>
                  <td style={{ padding: '10px 12px' }}>{e.facility}</td>
                  <td style={{ padding: '10px 12px' }}>{e.department}</td>
                  <td style={{ padding: '10px 12px', color: e.designation ? 'var(--text)' : 'var(--text-3)' }}>{e.designation ?? <em>—</em>}</td>
                  <td style={{ padding: '10px 12px', color: e.shift ? 'var(--text)' : 'var(--text-3)' }}>{e.shift ?? <em>—</em>}</td>
                  <td style={{ padding: '10px 12px', color: e.rollType ? 'var(--text)' : 'var(--text-3)' }}>{e.rollType ?? <em>—</em>}</td>
                  <td style={{ padding: '10px 12px', color: e.gender ? 'var(--text)' : 'var(--text-3)' }}>{e.gender ?? <em>—</em>}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ color: e.isActive ? 'var(--success)' : 'var(--text-3)', fontSize: 11 }}>
                      {e.isActive ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      onClick={() => openEdit(e)}
                      style={{ padding: '5px 12px', border: '1.5px solid var(--border)', borderRadius: 6, background: 'none', fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', transition: 'border-color 0.12s, background 0.12s' }}
                      onMouseEnter={(ev) => { const el = ev.currentTarget; el.style.borderColor = 'var(--accent)'; el.style.background = 'rgba(79,70,229,0.06)'; }}
                      onMouseLeave={(ev) => { const el = ev.currentTarget; el.style.borderColor = 'var(--border)'; el.style.background = 'none'; }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} style={{ padding: '60px', textAlign: 'center', color: 'var(--text-3)' }}>
                    {query ? 'No employees match your search' : 'No employees found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, animation: 'fadeIn 0.15s ease' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r)', padding: '28px 32px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18, margin: 0 }}>
                Edit — {editForm.employeeName}
              </h3>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                {editForm.employeeCode}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Name">
                <input
                  value={editForm.employeeName}
                  onChange={(e) => setEditForm({ ...editForm, employeeName: e.target.value })}
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
                />
              </Field>

              <Field label="Facility">
                {isSouthAdmin ? (
                  <select
                    value={editForm.facility}
                    onChange={(e) => setEditForm({ ...editForm, facility: e.target.value })}
                    style={{ ...inputStyle, color: 'var(--text)' }}
                  >
                    {['WH1', 'WH2'].map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                ) : (
                  <div style={{ ...inputStyle, background: 'var(--surface2)', color: 'var(--text-2)', cursor: 'default' }}>
                    {editForm.facility}
                  </div>
                )}
              </Field>

              <Field label="Department">
                <select
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  style={{ ...inputStyle, color: 'var(--text)' }}
                >
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>

              <Field label="Designation">
                <input
                  value={editForm.designation}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                  placeholder="e.g. Executive"
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
                />
              </Field>

              <Field label="Shift">
                <select
                  value={editForm.shift}
                  onChange={(e) => setEditForm({ ...editForm, shift: e.target.value })}
                  style={{ ...inputStyle, color: 'var(--text)' }}
                >
                  <option value="">— not set —</option>
                  {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="Roll Type">
                <select
                  value={editForm.rollType}
                  onChange={(e) => setEditForm({ ...editForm, rollType: e.target.value })}
                  style={{ ...inputStyle, color: 'var(--text)' }}
                >
                  <option value="">— not set —</option>
                  {ROLL_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>

              <Field label="Gender">
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  style={{ ...inputStyle, color: 'var(--text)' }}
                >
                  <option value="">— not set —</option>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>

              <Field label="Reporting Manager">
                <input
                  value={editForm.reportingManager}
                  onChange={(e) => setEditForm({ ...editForm, reportingManager: e.target.value })}
                  placeholder="Manager name"
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
                />
              </Field>
            </div>

            <Field label="Status">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                />
                Active
              </label>
            </Field>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => setEditForm(null)}
                style={{ padding: '9px 18px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'none', fontFamily: 'var(--mono)', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                style={{ padding: '9px 18px', border: 'none', borderRadius: 8, background: saving ? 'var(--surface2)' : 'var(--accent)', color: saving ? 'var(--text-3)' : 'var(--accent-text)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
