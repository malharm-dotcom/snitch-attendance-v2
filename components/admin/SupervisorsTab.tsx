'use client';

import { useState, useEffect, useCallback } from 'react';
import { DEPARTMENTS, FACILITIES } from '@/lib/constants';
import { useToast } from '../shared/Toast';

interface SupervisorRow {
  id: number;
  supervisorName: string;
  employeeCode: string | null;
  facility: string;
  department: string;
  departments: string[];
  pin: string;
  role: string;
  isActive: boolean;
}

const ROLES = ['supervisor', 'manager', 'admin'];

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

interface EditForm {
  id?: number;
  supervisorName: string;
  employeeCode: string;
  facility: string;
  department: string;
  departments: string[];
  role: string;
  isActive: boolean;
  newPassword: string;
}

const emptyForm = (): EditForm => ({
  supervisorName: '',
  employeeCode: '',
  facility: 'WH1',
  department: '',
  departments: [],
  role: 'supervisor',
  isActive: true,
  newPassword: '',
});

export default function SupervisorsTab() {
  const [supervisors, setSupervisors] = useState<SupervisorRow[]>([]);
  const [currentUser, setCurrentUser] = useState('');
  const [currentFacility, setCurrentFacility] = useState('');
  const [isSouthAdmin, setIsSouthAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<EditForm>(emptyForm());
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [filterRole, setFilterRole] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SupervisorRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/supervisors');
      const data = await res.json();
      setSupervisors(data.supervisors ?? []);
      setCurrentUser(data.currentUser ?? '');
      setCurrentFacility(data.currentFacility ?? '');
      setIsSouthAdmin(data.isSouthAdmin ?? false);
    } catch {
      showToast('Failed to load supervisors', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function openEdit(sup: SupervisorRow) {
    setEditForm({
      id: sup.id,
      supervisorName: sup.supervisorName,
      employeeCode: sup.employeeCode ?? '',
      facility: sup.facility,
      department: sup.department,
      departments: sup.departments,
      role: sup.role,
      isActive: sup.isActive,
      newPassword: '',
    });
  }

  function toggleDept(form: EditForm, dept: string, setter: (f: EditForm) => void) {
    const next = form.departments.includes(dept)
      ? form.departments.filter((d) => d !== dept)
      : [...form.departments, dept];
    setter({ ...form, departments: next });
  }

  async function saveEdit() {
    if (!editForm) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/supervisors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editForm.id,
          supervisor_name: editForm.supervisorName,
          employee_code: editForm.employeeCode || null,
          facility: editForm.facility,
          department: editForm.department || editForm.departments[0],
          departments: editForm.departments,
          role: editForm.role,
          is_active: editForm.isActive,
          new_password: editForm.newPassword || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('Supervisor updated', 'success');
      setEditForm(null);
      load();
    } catch (err: unknown) {
      showToast((err as Error).message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveAdd() {
    if (!addForm.supervisorName || !addForm.facility || !addForm.departments.length || !addForm.newPassword) {
      showToast('Name, facility, departments, and password are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/supervisors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisor_name: addForm.supervisorName,
          employee_code: addForm.employeeCode || null,
          facility: addForm.facility,
          department: addForm.departments[0],
          departments: addForm.departments,
          role: addForm.role,
          password: addForm.newPassword,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('Supervisor added', 'success');
      setShowAdd(false);
      setAddForm(emptyForm());
      load();
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to add', 'error');
    } finally {
      setSaving(false);
    }
  }

  const displayed = supervisors.filter((s) => {
    if (filterRole && s.role !== filterRole) return false;
    return true;
  });

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/supervisors', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast(`${deleteTarget.supervisorName} removed`, 'success');
      setSupervisors((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      showToast((err as Error).message || 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  }

  function canDelete(s: SupervisorRow) {
    if (s.role === 'manager') return false;
    if (s.supervisorName === currentUser) return false;
    return true;
  }

  function canEdit(s: SupervisorRow) {
    if (s.role === 'manager') return false;
    if (s.supervisorName === currentUser) return false;
    return true;
  }

  const roleBadge: Record<string, React.CSSProperties> = {
    admin:      { background: 'rgba(220,38,38,0.1)',  color: '#dc2626' },
    manager:    { background: 'rgba(79,70,229,0.1)',  color: '#4f46e5' },
    supervisor: { background: 'rgba(22,163,74,0.1)',  color: '#16a34a' },
  };

  function DeptCheckboxes({ form, setter }: { form: EditForm; setter: (f: EditForm) => void }) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {DEPARTMENTS.map((d) => (
          <label key={d} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 10px',
            border: '1.5px solid',
            borderColor: form.departments.includes(d) ? 'var(--accent)' : 'var(--border)',
            borderRadius: 20,
            fontFamily: 'var(--mono)',
            fontSize: 11,
            cursor: 'pointer',
            background: form.departments.includes(d) ? 'rgba(79,70,229,0.08)' : 'transparent',
            transition: 'all 0.12s',
            userSelect: 'none',
          }}>
            <input
              type="checkbox"
              checked={form.departments.includes(d)}
              onChange={() => toggleDept(form, d, setter)}
              style={{ display: 'none' }}
            />
            {d}
          </label>
        ))}
      </div>
    );
  }

  function FormPanel({ form, setter, title, onSave, onCancel, allowFacilityChange }: {
    form: EditForm;
    setter: (f: EditForm) => void;
    title: string;
    onSave: () => void;
    onCancel: () => void;
    allowFacilityChange?: boolean;
  }) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
        animation: 'fadeIn 0.15s ease',
      }}>
        <div style={{
          background: 'var(--surface)',
          borderRadius: 'var(--r)',
          padding: '28px 32px',
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
        }}>
          <h3 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18, margin: 0 }}>{title}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Name">
              <input value={form.supervisorName} onChange={(e) => setter({ ...form, supervisorName: e.target.value })} style={inputStyle} onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }} />
            </Field>
            <Field label="Employee Code">
              <input value={form.employeeCode} onChange={(e) => setter({ ...form, employeeCode: e.target.value })} placeholder="e.g. SAPL00264" style={inputStyle} onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }} />
            </Field>
            <Field label="Facility">
              {allowFacilityChange ? (
                <select value={form.facility} onChange={(e) => setter({ ...form, facility: e.target.value })} style={{ ...inputStyle, color: 'var(--text)' }}>
                  {(['WH1', 'WH2'] as string[]).map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              ) : (
                <div style={{ ...inputStyle, background: 'var(--surface2)', color: 'var(--text-2)', cursor: 'default' }}>{form.facility}</div>
              )}
            </Field>
            <Field label="Role">
              <select value={form.role} onChange={(e) => setter({ ...form, role: e.target.value })} style={{ ...inputStyle }}>
                {ROLES.map((r) => <option key={r} value={r} style={{ textTransform: 'capitalize' }}>{r}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Departments">
            <DeptCheckboxes form={form} setter={setter} />
          </Field>

          <Field label={form.id ? 'New Password (leave blank to keep current)' : 'Password'}>
            <div style={{ position: 'relative' }}>
              <input
                type={passwordVisible ? 'text' : 'password'}
                value={form.newPassword}
                onChange={(e) => setter({ ...form, newPassword: e.target.value })}
                placeholder={form.id ? 'Leave blank to keep current' : 'Set initial password'}
                style={{ ...inputStyle, paddingRight: 52 }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
              />
              <button type="button" onClick={() => setPasswordVisible((v) => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>
                {passwordVisible ? 'hide' : 'show'}
              </button>
            </div>
          </Field>

          {form.id && (
            <Field label="Status">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 13 }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setter({ ...form, isActive: e.target.checked })} />
                Active
              </label>
            </Field>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={onCancel} style={{ padding: '9px 18px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'none', fontFamily: 'var(--mono)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={onSave} disabled={saving} style={{ padding: '9px 18px', border: 'none', borderRadius: 8, background: saving ? 'var(--surface2)' : 'var(--accent)', color: saving ? 'var(--text-3)' : 'var(--accent-text)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18, margin: 0 }}>
          Supervisors
          {!loading && <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-3)', fontWeight: 400, marginLeft: 8 }}>{supervisors.length} total</span>}
        </h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {currentFacility && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '4px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text-2)' }}>
              {currentFacility}
            </span>
          )}
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} style={{ padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 12, background: 'var(--surface)', color: 'var(--text)' }}>
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r} style={{ textTransform: 'capitalize' }}>{r}</option>)}
          </select>
          <button onClick={() => { setAddForm({ ...emptyForm(), facility: currentFacility }); setShowAdd(true); }} style={{ padding: '7px 16px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: 'var(--accent-text)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-d)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}>
            + Add
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />)}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--mono)' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '2px solid var(--border)' }}>
                {['Employee Code', 'Name', 'Facility', 'Departments', 'Role', 'Status', '', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', color: 'var(--text-2)', whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
                >
                  <td style={{ padding: '10px 12px', color: s.employeeCode ? 'var(--text)' : 'var(--text-3)' }}>
                    {s.employeeCode ?? <em>not set</em>}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--display)', fontWeight: 600 }}>{s.supervisorName}</td>
                  <td style={{ padding: '10px 12px' }}>{s.facility}</td>
                  <td style={{ padding: '10px 12px', maxWidth: 200 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {s.departments.slice(0, 3).map((d) => (
                        <span key={d} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '2px 7px', fontSize: 10 }}>{d}</span>
                      ))}
                      {s.departments.length > 3 && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>+{s.departments.length - 3}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ ...roleBadge[s.role] ?? {}, padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                      {s.role}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ color: s.isActive ? 'var(--success)' : 'var(--text-3)', fontSize: 11 }}>
                      {s.isActive ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {canEdit(s) ? (
                      <button onClick={() => openEdit(s)} style={{ padding: '5px 12px', border: '1.5px solid var(--border)', borderRadius: 6, background: 'none', fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', transition: 'border-color 0.12s, background 0.12s' }}
                        onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = 'var(--accent)'; el.style.background = 'rgba(79,70,229,0.06)'; }}
                        onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = 'var(--border)'; el.style.background = 'none'; }}
                      >
                        Edit
                      </button>
                    ) : (
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>
                        {s.supervisorName === currentUser ? 'You' : s.role === 'manager' ? '—' : ''}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {canDelete(s) ? (
                      <button
                        onClick={() => {
                          if (s.role === 'manager') { showToast('Manager accounts cannot be deleted', 'error'); return; }
                          setDeleteTarget(s);
                        }}
                        style={{ padding: '5px 12px', border: '1.5px solid var(--danger, #dc2626)', borderRadius: 6, background: 'none', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--danger, #dc2626)', cursor: 'pointer', transition: 'border-color 0.12s, background 0.12s' }}
                        onMouseEnter={(e) => { const el = e.currentTarget; el.style.background = 'rgba(220,38,38,0.06)'; }}
                        onMouseLeave={(e) => { const el = e.currentTarget; el.style.background = 'none'; }}
                      >
                        Delete
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {displayed.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '60px', textAlign: 'center', color: 'var(--text-3)' }}>No supervisors found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editForm && (
        <FormPanel
          form={editForm}
          setter={setEditForm}
          title={`Edit — ${editForm.supervisorName}`}
          onSave={saveEdit}
          onCancel={() => setEditForm(null)}
        />
      )}

      {showAdd && (
        <FormPanel
          form={addForm}
          setter={setAddForm}
          title="Add Supervisor"
          onSave={saveAdd}
          onCancel={() => setShowAdd(false)}
          allowFacilityChange={isSouthAdmin}
        />
      )}

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, animation: 'fadeIn 0.15s ease' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--r)', padding: '28px 32px', width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h3 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18, margin: 0 }}>Remove supervisor?</h3>
            <p style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
              Remove <strong style={{ color: 'var(--text)' }}>{deleteTarget.supervisorName}</strong> from <strong style={{ color: 'var(--text)' }}>{deleteTarget.facility}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} style={{ padding: '9px 18px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'none', fontFamily: 'var(--mono)', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting} style={{ padding: '9px 18px', border: 'none', borderRadius: 8, background: deleting ? 'var(--surface2)' : 'var(--danger, #dc2626)', color: deleting ? 'var(--text-3)' : '#fff', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, cursor: deleting ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}>
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
