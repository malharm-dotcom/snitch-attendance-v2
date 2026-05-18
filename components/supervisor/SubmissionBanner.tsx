'use client';

import { istTimestamp } from '@/lib/ist';

interface SubmissionBannerProps {
  markedBy: string;
  markedAt: string | Date;
  requestStatus?: string | null;
  onRequestRewrite: () => void;
}

export default function SubmissionBanner({ markedBy, markedAt, requestStatus, onRequestRewrite }: SubmissionBannerProps) {
  const isPending = requestStatus === 'pending';
  const isApproved = requestStatus === 'approved';

  return (
    <div style={{
      background: isPending ? '#fff8e1' : '#e8f7ee',
      border: `1.5px solid ${isPending ? 'var(--warn)' : 'var(--success)'}`,
      borderRadius: 'var(--r)',
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <div>
        <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14, color: isPending ? 'var(--warn)' : 'var(--success)' }}>
          {isPending ? 'Rewrite Pending' : isApproved ? 'Rewrite Approved — You may resubmit' : '✓ Attendance Submitted'}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
          Marked by {markedBy} · {istTimestamp(new Date(markedAt))}
        </div>
      </div>
      {!isPending && !isApproved && (
        <button
          onClick={onRequestRewrite}
          style={{
            padding: '7px 14px',
            background: 'none',
            border: '1.5px solid var(--border)',
            borderRadius: 8,
            fontFamily: 'var(--mono)',
            fontSize: 12,
            color: 'var(--text-2)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Request Edit
        </button>
      )}
    </div>
  );
}
