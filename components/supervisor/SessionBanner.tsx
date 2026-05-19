'use client';

import { DEPARTMENTS } from '@/lib/constants';

interface SessionBannerProps {
  name: string;
  facility: string;
  department: string;
  departments: string[];
  role: string;
  shift: 'Day' | 'Night';
  onShiftChange: (shift: 'Day' | 'Night') => void;
  onDepartmentChange?: (dept: string) => void;
  employeesLoaded?: boolean;
}

export default function SessionBanner({
  name,
  facility,
  department,
  departments,
  role,
  shift,
  onShiftChange,
  onDepartmentChange,
  employeesLoaded,
}: SessionBannerProps) {
  function handleShift(s: 'Day' | 'Night') {
    if (s === shift) return;
    onShiftChange(s);
  }

  function handleDeptChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!onDepartmentChange) return;
    const newDept = e.target.value;
    if (employeesLoaded) {
      const ok = window.confirm('Switching department will clear the current employee list. Continue?');
      if (!ok) { e.target.value = department; return; }
    }
    onDepartmentChange(newDept);
  }

  return (
    <div style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500 }}>{name}</span>

      <span style={{
        background: 'var(--accent)',
        color: 'var(--accent-text)',
        fontFamily: 'var(--mono)',
        fontSize: 11,
        padding: '2px 10px',
        borderRadius: 20,
        fontWeight: 500,
      }}>
        {facility}
      </span>

      {role === 'admin' && onDepartmentChange ? (
        <select
          value={department}
          onChange={handleDeptChange}
          style={{
            border: '1.5px solid var(--border)',
            borderRadius: 20,
            fontFamily: 'var(--mono)',
            fontSize: 11,
            padding: '2px 10px',
            background: 'var(--surface)',
            color: 'var(--text)',
            cursor: 'pointer',
          }}
        >
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      ) : (
        <span style={{
          border: '1.5px solid var(--border)',
          fontFamily: 'var(--mono)',
          fontSize: 11,
          padding: '2px 10px',
          borderRadius: 20,
          color: 'var(--text-2)',
        }}>
          {departments.length > 1 ? departments.join(', ') : department}
        </span>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
        {(['Day', 'Night'] as const).map((s) => (
          <button
            key={s}
            onClick={() => handleShift(s)}
            style={{
              padding: '5px 14px',
              border: 'none',
              borderRadius: 20,
              fontFamily: 'var(--mono)',
              fontSize: 12,
              cursor: 'pointer',
              background: shift === s ? 'var(--accent)' : 'var(--surface2)',
              color: shift === s ? 'var(--accent-text)' : 'var(--text-2)',
              transition: 'all 0.15s',
            }}
          >
            {s === 'Day' ? '☀ Day' : '🌙 Night'}
          </button>
        ))}
      </div>
    </div>
  );
}
