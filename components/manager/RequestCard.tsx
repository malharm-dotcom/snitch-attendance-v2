'use client';

import { formatIST } from '@/lib/formatIST';

export interface RewriteRequest {
  request_id: number;
  attendance_date: string;
  facility: string;
  department: string;
  employee_code: string | null;
  supervisor_name: string;
  reason: string;
  request_status: string;
  requested_at: string;
  actioned_by: string | null;
  actioned_at: string | null;
}

interface RequestCardProps {
  request: RewriteRequest;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
  onAction?: (id: number, action: 'approve' | 'reject') => void;
  showCheckbox?: boolean;
  currentUser?: string;
}

export default function RequestCard({ request, selected, onToggleSelect, onAction, showCheckbox, currentUser }: RequestCardProps) {
  const isPending = request.request_status === 'pending';
  const isOwnRequest = !!currentUser && request.supervisor_name === currentUser;

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 'var(--r)',
      padding: '16px',
      display: 'flex',
      gap: 12,
    }}>
      {showCheckbox && isPending && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onToggleSelect?.(request.request_id)}
          style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2, cursor: 'pointer' }}
        />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14 }}>
            {request.supervisor_name}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)', background: 'var(--surface2)', padding: '2px 8px', borderRadius: 20 }}>
            {request.facility} · {request.department}
          </span>
          {request.employee_code && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', background: 'rgba(79,70,229,0.08)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
              {request.employee_code}
            </span>
          )}
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)' }}>
            {String(request.attendance_date).slice(0, 10)}
          </span>
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 20,
            fontWeight: 600,
            background: isPending ? 'var(--warn-bg)' : request.request_status === 'approved' ? 'var(--success-bg)' : 'var(--danger-bg)',
            color: isPending ? 'var(--warn)' : request.request_status === 'approved' ? 'var(--success)' : 'var(--danger)',
          }}>
            {request.request_status}
          </span>
        </div>

        <p style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.5 }}>
          {request.reason}
        </p>

        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>
          Requested {formatIST(request.requested_at)}
          {request.actioned_by && ` · ${request.request_status} by ${request.actioned_by}`}
        </div>

        {isPending && (
          isOwnRequest ? (
            <div style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
              Awaiting manager review
            </div>
          ) : onAction ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => onAction(request.request_id, 'approve')}
                style={{ padding: '7px 16px', border: 'none', borderRadius: 6, background: 'var(--success)', color: '#fff', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Approve
              </button>
              <button
                onClick={() => onAction(request.request_id, 'reject')}
                style={{ padding: '7px 16px', border: '1.5px solid var(--danger)', borderRadius: 6, background: 'none', color: 'var(--danger)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Reject
              </button>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
