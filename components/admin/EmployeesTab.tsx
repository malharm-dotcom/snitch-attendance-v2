'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DEPARTMENTS } from '@/lib/constants';
import { useToast } from '../shared/Toast';
import { istDateString } from '@/lib/ist';

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

type CsvRow = Record<string, string>;

const REQUIRED_HEADERS = [
  'employee_code', 'employee_name', 'facility', 'department',
  'is_active', 'shift', 'designation', 'reporting_manager', 'roll_type', 'gender',
];

const EXAMPLE_ROW: CsvRow = {
  employee_code: 'SAPL00001',
  employee_name: 'John Doe',
  facility: 'WH1',
  department: 'B2C Forward',
  is_active: 'TRUE',
  shift: 'Day',
  designation: 'Executive',
  reporting_manager: 'Manager Name',
  roll_type: 'On-Roll',
  gender: 'Male',
};

const SHIFTS = ['Day', 'Night'];
const ROLL_TYPES = ['On-Roll', 'Off-Roll'];
const GENDERS = ['Male', 'Female', 'Other'];

function parseCSV(text: string): CsvRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: CsvRow = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

function toCSV(headers: string[], rows: CsvRow[]): string {
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

function downloadBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

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

const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  border: '1.5px solid var(--border)',
  borderRadius: 8,
  fontFamily: 'var(--mono)',
  fontSize: 12,
  cursor: 'pointer',
  background: 'var(--surface)',
  color: 'var(--text)',
  transition: 'background 0.15s, border-color 0.15s',
  fontWeight: 500,
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
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ inserted: number; updated: number; errors: { row: number; error: string }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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

  function downloadTemplate() {
    downloadBlob(toCSV(REQUIRED_HEADERS, [EXAMPLE_ROW]), 'employee_template.csv');
  }

  async function handleExport() {
    setDownloading(true);
    try {
      const res = await fetch('/api/reports/employees');
      if (!res.ok) throw new Error('Export failed');
      const json = await res.json();
      const rows: Record<string, unknown>[] = json.employees ?? [];
      if (!rows.length) { showToast('No employee data found', 'info'); return; }
      const mapped: CsvRow[] = rows.map((e) => ({
        employee_code: String(e.employee_code ?? e.employeeCode ?? ''),
        employee_name: String(e.employee_name ?? e.employeeName ?? ''),
        facility: String(e.facility ?? ''),
        department: String(e.department ?? ''),
        is_active: String(e.is_active ?? e.isActive ?? ''),
        shift: String(e.shift ?? ''),
        designation: String(e.designation ?? ''),
        reporting_manager: String(e.reporting_manager ?? e.reportingManager ?? ''),
        roll_type: String(e.roll_type ?? e.rollType ?? ''),
        gender: String(e.gender ?? ''),
      }));
      const date = istDateString();
      const facility = currentFacility || (json.scope ?? 'all');
      downloadBlob(toCSV(REQUIRED_HEADERS, mapped), `employees_${facility}_${date}.csv`);
      showToast(`Downloaded ${mapped.length} employees`, 'success');
    } catch {
      showToast('Failed to export employee data', 'error');
    } finally {
      setDownloading(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected if needed
    e.target.value = '';

    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) { showToast('CSV is empty or has no data rows', 'error'); return; }

    setUploading(true);
    setUploadResult(null);
    try {
      const res = await fetch('/api/employees/bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      setUploadResult(data);
      const upserted = (data.inserted ?? 0) + (data.updated ?? 0);
      const errCount = data.errors?.length ?? 0;
      showToast(
        `Uploaded: ${upserted} upserted, ${errCount} errors`,
        errCount > 0 ? 'error' : 'success',
      );
      // Reload table so newly upserted employees are visible
      load();
    } catch {
      showToast('Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

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
      // Patch local state — no full reload needed
      setEmployees((prev) => prev.map((e) =>
        e.employeeCode === editForm.employeeCode
          ? {
              ...e,
              employeeName: editForm.employeeName,
              facility: editForm.facility,
              department: editForm.department,
              designation: editForm.designation || null,
              shift: editForm.shift || null,
              isActive: editForm.isActive,
              rollType: editForm.rollType || null,
              gender: editForm.gender || null,
              reportingManager: editForm.reportingManager || null,
            }
          : e,
      ));
      showToast('Employee updated', 'success');
      setEditForm(null);
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
        {currentFacility && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '4px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text-2)' }}>
            {currentFacility}
          </span>
        )}
      </div>

      {/* ── SECTION 1: Bulk Actions ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '12px 16px', background: 'var(--surface2)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 4 }}>Bulk Actions</span>

        <button onClick={downloadTemplate} style={btnStyle}>
          ↓ Download Template
        </button>

        <button
          onClick={handleExport}
          disabled={downloading}
          style={{ ...btnStyle, borderColor: downloading ? 'var(--border)' : 'var(--accent)', color: downloading ? 'var(--text-3)' : 'var(--text)', cursor: downloading ? 'not-allowed' : 'pointer' }}
        >
          {downloading ? 'Exporting...' : '↓ Export Current Data'}
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{ ...btnStyle, borderColor: uploading ? 'var(--border)' : 'var(--border)', color: uploading ? 'var(--text-3)' : 'var(--text)', cursor: uploading ? 'not-allowed' : 'pointer' }}
        >
          {uploading ? 'Uploading...' : '↑ Upload CSV'}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
      </div>

      {/* Upload result errors */}
      {uploadResult && uploadResult.errors.length > 0 && (
        <div style={{ background: 'var(--surface2)', borderRadius: 'var(--r)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
            Upload result: <span style={{ color: 'var(--success)' }}>✓ {uploadResult.inserted} inserted</span>{' '}
            <span style={{ color: 'var(--warn)' }}>↻ {uploadResult.updated} updated</span>{' '}
            <span style={{ color: 'var(--danger)' }}>✗ {uploadResult.errors.length} errors</span>
          </div>
          {uploadResult.errors.map((e) => (
            <div key={e.row} style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--danger)' }}>
              Row {e.row}: {e.error}
            </div>
          ))}
        </div>
      )}

      {/* ── SECTION 2: Employee Table ── */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or employee code…"
        style={{ ...inputStyle, maxWidth: 360 }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
      />

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
