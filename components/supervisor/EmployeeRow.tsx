'use client';

import { useRef, useState } from 'react';
import { ATTENDANCE_STATUSES, STATUS_CLASSES } from '@/lib/constants';
import HistoryStrip from './HistoryStrip';

export interface EmployeeEntry {
  id: number;
  employee_code: string;
  employee_name: string;
  facility: string;
  department: string;
  shift: string | null;
  designation: string | null;
  attendance_status: string;
  remarks: string;
}

interface EmployeeRowProps {
  employee: EmployeeEntry;
  searchQuery: string;
  onChange: (code: string, field: 'attendance_status' | 'remarks', value: string) => void;
  disabled?: boolean;
  /** 7 calendar days (oldest → newest) for the read-only history strip. */
  stripDays?: string[];
  /** Map of YYYY-MM-DD → status for this employee's previous-7-days strip. */
  stripStatuses?: Record<string, string>;
  /** True while strip data is still loading (shows subtle skeletons). */
  stripLoading?: boolean;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--accent)', color: 'var(--accent-text)', padding: 0 }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const REMARKS_NEEDED = ['LOP', 'Sick Leave', 'Paid Leave', 'Unpaid Leave', 'Half Day', 'Maternity Leave', 'Paternity Leave', 'Bereavement Leave', 'Compensatory Off'];

export default function EmployeeRow({ employee, searchQuery, onChange, disabled, stripDays, stripStatuses, stripLoading }: EmployeeRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [justChanged, setJustChanged] = useState(false);

  const showRemarks = REMARKS_NEEDED.includes(employee.attendance_status);
  const cls = STATUS_CLASSES[employee.attendance_status] ?? 'present';

  const statusBg = employee.attendance_status === 'Present' ? 'var(--success-bg)' :
                   employee.attendance_status === 'Absent'  ? 'var(--danger-bg)'  : 'var(--warn-bg)';
  const statusColor = employee.attendance_status === 'Present' ? 'var(--success)' :
                      employee.attendance_status === 'Absent'  ? 'var(--danger)'  : 'var(--warn)';

  function handleStatusChange(val: string) {
    onChange(employee.employee_code, 'attendance_status', val);
    setJustChanged(true);
    setTimeout(() => setJustChanged(false), 420);
  }

  return (
    <div
      ref={rowRef}
      style={{
        background: justChanged ? 'rgba(200,223,32,0.15)' : 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'background 0.4s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--display)', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {highlightText(employee.employee_name, searchQuery)}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
            {highlightText(employee.employee_code, searchQuery)}
            {employee.department && ` · ${employee.department}`}
            {employee.designation && ` · ${employee.designation}`}
          </div>
        </div>

        <span className={`chip-${cls}`} style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {employee.attendance_status}
        </span>

        <select
          value={employee.attendance_status}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={disabled}
          style={{
            border: `1.5px solid ${statusColor}`,
            borderRadius: 6,
            fontFamily: 'var(--mono)',
            fontSize: 12,
            padding: '5px 8px',
            background: statusBg,
            color: statusColor,
            cursor: disabled ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        >
          {ATTENDANCE_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {stripDays && stripDays.length > 0 && (
        <HistoryStrip days={stripDays} statuses={stripStatuses} loading={stripLoading} />
      )}

      <div style={{
        overflow: 'hidden',
        maxHeight: showRemarks ? 100 : 0,
        opacity: showRemarks ? 1 : 0,
        transition: 'max-height 0.2s ease, opacity 0.2s ease',
      }}>
        <textarea
          value={employee.remarks}
          onChange={(e) => onChange(employee.employee_code, 'remarks', e.target.value)}
          placeholder="Add remarks (optional)..."
          disabled={disabled}
          rows={2}
          style={{
            width: '100%',
            border: '1.5px solid var(--border)',
            borderRadius: 6,
            padding: '8px 10px',
            fontFamily: 'var(--mono)',
            fontSize: 12,
            resize: 'vertical',
            background: 'var(--surface2)',
            color: 'var(--text)',
            outline: 'none',
          }}
        />
      </div>
    </div>
  );
}
