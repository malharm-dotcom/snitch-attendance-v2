'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../shared/Toast';

export interface OtRequestRow {
  id: number;
  employee_code: string;
  employee_name: string;
  department: string;
  facility: string;
  ot_date: string;
  ot_hours: number;
  reason: string;
  status: string;
  requested_by: string;
  approved_by: string | null;
  rejection_reason: string | null;
}

type QueueStatus = 'Pending' | 'Approved' | 'Rejected';

const STATUS_COLOR: Record<string, string> = {
  Pending: 'var(--warn)',
  Approved: 'var(--success)',
  Rejected: 'var(--danger)',
};

export default function OtApprovalQueue() {
  const [status, setStatus] = useState<QueueStatus>('Pending');
  const [rows, setRows] = useState<OtRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const { showToast } = useToast();

  // No facility param — the server scopes the queue from the session.
  const load = useCallback(async (s: QueueStatus) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ot/list?status=${s}`);
      const data = await res.json();
      setRows(data.requests ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(status);
  }, [status, load]);

  async function action(id: number, act: 'approve' | 'reject') {
    setBusyId(id);
    try {
      const res = await fetch('/api/ot/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: id, action: act, comment: comments[id] ?? '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Action failed (${res.status})`);
      showToast(`OT request ${act === 'approve' ? 'approved' : 'rejected'}`, 'success');
      load(status);
    } catch (err: unknown) {
      showToast((err as Error).message || 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', padding: 3, borderRadius: 'var(--r)', width: 'fit-content' }}>
        {(['Pending', 'Approved', 'Rejected'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            style={{
              padding: '7px 16px', border: 'none', borderRadius: 8,
              background: status === s ? 'var(--surface)' : 'transparent',
              color: status === s ? 'var(--text)' : 'var(--text-2)',
              fontFamily: 'var(--mono)', fontSize: 13, cursor: 'pointer',
              fontWeight: status === s ? 600 : 400,
              boxShadow: status === s ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 8 }} />)}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
          No {status.toLowerCase()} OT requests
        </div>
      )}

      {!loading && rows.map((r) => (
        <div key={r.id} style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 14 }}>{r.employee_name || r.employee_code}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>
                {r.employee_code} · {r.department} · {r.facility}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 15 }}>{r.ot_hours}h</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>{r.ot_date}</div>
            </div>
          </div>

          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)' }}>{r.reason}</div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>
              Raised by {r.requested_by}
              {r.approved_by && ` · actioned by ${r.approved_by}`}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: STATUS_COLOR[r.status] ?? 'var(--text-2)' }}>
              {r.status}
            </span>
          </div>

          {r.status === 'Rejected' && r.rejection_reason && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--danger)' }}>Comment: {r.rejection_reason}</div>
          )}

          {r.status === 'Pending' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Optional — only a rejection has a column to store it in. */}
              <input
                type="text"
                placeholder="Comment (kept on reject)"
                value={comments[r.id] ?? ''}
                onChange={(e) => setComments((c) => ({ ...c, [r.id]: e.target.value }))}
                style={{ flex: 1, minWidth: 160, padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 12 }}
              />
              <button
                onClick={() => action(r.id, 'approve')}
                disabled={busyId === r.id}
                style={{ padding: '7px 16px', border: 'none', borderRadius: 8, background: 'var(--success)', color: '#fff', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 12, cursor: busyId === r.id ? 'not-allowed' : 'pointer' }}
              >
                Approve
              </button>
              <button
                onClick={() => action(r.id, 'reject')}
                disabled={busyId === r.id}
                style={{ padding: '7px 16px', border: '1.5px solid var(--danger)', borderRadius: 8, background: 'var(--surface)', color: 'var(--danger)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 12, cursor: busyId === r.id ? 'not-allowed' : 'pointer' }}
              >
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
