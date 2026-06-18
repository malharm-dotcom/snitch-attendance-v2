'use client';

import { formatIST } from '@/lib/formatIST';

interface SubmissionBannerProps {
  markedBy: string;
  markedAt: string | Date;
  requestStatus?: string | null;
  rewriteSummary?: Record<string, number> | null;
  onRequestRewrite: () => void;
}

export default function SubmissionBanner({
  markedBy,
  markedAt,
  requestStatus,
  rewriteSummary,
  onRequestRewrite,
}: SubmissionBannerProps) {
  const approvedCount = rewriteSummary?.approved ?? 0;
  const pendingCount = rewriteSummary?.pending ?? 0;
  const rejectedCount = rewriteSummary?.rejected ?? 0;
  const hasRequests = rewriteSummary !== null && rewriteSummary !== undefined;

  // Compact summary: "2 approved · 1 pending · 1 rejected"
  const parts: string[] = [];
  if (approvedCount > 0) parts.push(`${approvedCount} approved`);
  if (pendingCount > 0) parts.push(`${pendingCount} pending`);
  if (rejectedCount > 0) parts.push(`${rejectedCount} rejected`);
  const summaryLine = parts.join(' · ');

  // Fall back to legacy single-status when no per-employee summary
  const hasAnyApproved = approvedCount > 0 || (!hasRequests && requestStatus === 'approved');
  const hasAnyPending = pendingCount > 0 || (!hasRequests && requestStatus === 'pending');

  const accentColor = hasAnyApproved ? 'var(--success)' : hasAnyPending ? 'var(--warn)' : 'var(--success)';
  const bgColor = hasAnyApproved ? 'var(--success-bg)' : hasAnyPending ? 'var(--warn-bg)' : 'var(--success-bg)';

  const title = hasAnyApproved
    ? 'Rewrite Approved — Approved employees can be resubmitted'
    : hasAnyPending
      ? 'Rewrite Pending'
      : '✓ Attendance Submitted';

  return (
    <div style={{
      background: bgColor,
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: 'var(--r)',
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <div>
        <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14, color: accentColor }}>
          {title}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
          Marked by {markedBy} · {formatIST(markedAt)}
        </div>
        {summaryLine && (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>
            {summaryLine}
          </div>
        )}
      </div>
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
          flexShrink: 0,
        }}
      >
        Request Edit
      </button>
    </div>
  );
}
