'use client';

import { istTimestamp } from '@/lib/ist';

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
  onClick: () => void;
}

export default function DeptCard({ facility, department, submission, onClick }: DeptCardProps) {
  const submitted = !!submission;

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: `1.5px solid ${submitted ? 'var(--success)' : 'var(--border)'}`,
        borderRadius: 'var(--r)',
        padding: '14px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
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
          background: submitted ? '#e8f7ee' : 'var(--surface2)',
          color: submitted ? 'var(--success)' : 'var(--text-3)',
        }}>
          {submitted ? '✓ Submitted' : 'Pending'}
        </span>
      </div>

      {submitted && submission && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)' }}>
          {submission.marked_by} · {istTimestamp(new Date(submission.marked_at))}
          {submission.shift && ` · ${submission.shift}`}
        </div>
      )}
    </div>
  );
}
