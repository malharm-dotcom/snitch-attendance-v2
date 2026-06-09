'use client';

import { formatIST } from '@/lib/formatIST';

interface Submission {
  facility: string;
  department: string;
  marked_by: string;
  marked_at: string;
  shift: string | null;
}

interface DeptCardProps {
  facility: string;
  department: string;
  submission: Submission | null;
  hasEmployees: boolean;
  onClick: () => void;
  attendanceDate?: string;
}

export default function DeptCard({ facility, department, submission, hasEmployees, onClick, attendanceDate }: DeptCardProps) {
  const submitted = !!submission;

  const noEmployees = !hasEmployees && !submitted;

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: submitted ? '3px solid var(--success)' : '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '14px',
        cursor: 'pointer',
        opacity: noEmployees ? 0.55 : 1,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.1)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14 }}>{department}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{facility}</div>
        </div>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 10,
          padding: '3px 8px',
          borderRadius: 20,
          fontWeight: 600,
          background: submitted ? 'var(--success-bg)' : noEmployees ? 'var(--surface2)' : 'var(--surface2)',
          color: submitted ? 'var(--success)' : noEmployees ? 'var(--text-3)' : 'var(--warn)',
        }}>
          {submitted ? '✓ Submitted' : noEmployees ? 'No employees' : 'Pending'}
        </span>
      </div>

      {submitted && submission && (
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)' }}>
            {submission.marked_by} · {formatIST(submission.marked_at)}
            {submission.shift && ` · ${submission.shift}`}
          </div>
          {submission.shift === 'Night' && attendanceDate && (() => {
            const d = new Date(attendanceDate + 'T00:00:00Z');
            d.setUTCDate(d.getUTCDate() + 1);
            const next = d.toISOString().slice(0, 10);
            return (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>
                Night shift (covers {attendanceDate} → {next})
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
