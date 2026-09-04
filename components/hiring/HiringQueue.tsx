'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../shared/Toast';

export interface HiringRow {
  id: number;
  department: string;
  sub_department: string | null;
  position: string;
  headcount: number;
  facility: string;
  req_type: string;
  justification: string;
  requested_by: string;
  expected_joining_date: string;
  status: string;
  mgr_approved_by: string | null;
  admin_approved_by: string | null;
  rejection_reason: string | null;
  joined_count: number;
  joined_notes: string | null;
}

const FILTERS = ['Pending Manager', 'Pending HR/Admin', 'Approved', 'In Progress', 'Joined', 'Rejected', 'Closed'] as const;

const STATUS_COLOR: Record<string, string> = {
  'Pending Manager': 'var(--warn)',
  'Pending HR/Admin': 'var(--warn)',
  'Approved': 'var(--success)',
  'In Progress': 'var(--accent)',
  'Joined': 'var(--success)',
  'Rejected': 'var(--danger)',
  'Closed': 'var(--text-3)',
};

const btn: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 8, fontFamily: 'var(--display)', fontWeight: 700,
  fontSize: 12, cursor: 'pointer', border: 'none',
};
const input: React.CSSProperties = {
  padding: '7px 10px', border: '1.5px solid var(--border)', borderRadius: 8,
  fontFamily: 'var(--mono)', fontSize: 12,
};

interface Props {
  /** Session role — drives which buttons render. The server re-checks regardless. */
  role: string;
}

export default function HiringQueue({ role }: Props) {
  const [filter, setFilter] = useState<string>('Pending Manager');
  const [rows, setRows] = useState<HiringRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [joined, setJoined] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const { showToast } = useToast();

  const isAdmin = role === 'admin';
  const canApproveStage1 = role === 'manager' || isAdmin;

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hiring/list?status=${encodeURIComponent(status)}`);
      const data = await res.json();
      setRows(data.requests ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);

  async function act(id: number, action: string, extra: Record<string, unknown> = {}) {
    setBusyId(id);
    try {
      const res = await fetch('/api/hiring/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: id, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Action failed (${res.status})`);
      showToast(`Request now ${data.status}`, 'success');
      load(filter);
    } catch (err: unknown) {
      showToast((err as Error).message || 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  function reject(id: number) {
    const c = (comments[id] ?? '').trim();
    if (!c) {
      showToast('A comment is required when rejecting', 'error');
      return;
    }
    act(id, 'reject', { comment: c });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', padding: 3, borderRadius: 'var(--r)', flexWrap: 'wrap' }}>
        {FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: '6px 12px', border: 'none', borderRadius: 8,
              background: filter === s ? 'var(--surface)' : 'transparent',
              color: filter === s ? 'var(--text)' : 'var(--text-2)',
              fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer',
              fontWeight: filter === s ? 600 : 400,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 8 }} />)}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
          No requests at &ldquo;{filter}&rdquo;
        </div>
      )}

      {!loading && rows.map((r) => (
        <div key={r.id} style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 14 }}>
                {r.position} · {r.headcount} {r.headcount === 1 ? 'position' : 'positions'}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>
                {r.department}{r.sub_department ? ` / ${r.sub_department}` : ''} · {r.facility} · {r.req_type}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: STATUS_COLOR[r.status] ?? 'var(--text-2)' }}>{r.status}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>by {r.expected_joining_date}</div>
            </div>
          </div>

          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)' }}>{r.justification}</div>

          {/* Approval trail */}
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>
            Raised by {r.requested_by}
            {r.mgr_approved_by && ` · mgr: ${r.mgr_approved_by}`}
            {r.admin_approved_by && ` · HR: ${r.admin_approved_by}`}
            {r.status === 'Joined' && ` · joined ${r.joined_count}/${r.headcount}`}
          </div>
          {r.rejection_reason && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--danger)' }}>Rejected: {r.rejection_reason}</div>
          )}
          {r.joined_notes && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)' }}>Notes: {r.joined_notes}</div>
          )}

          {/* Stage 1 + 2: approve / reject. Buttons render per role; the server re-checks. */}
          {(r.status === 'Pending Manager' || r.status === 'Pending HR/Admin') &&
           (r.status === 'Pending Manager' ? canApproveStage1 : isAdmin) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Comment (required to reject)"
                value={comments[r.id] ?? ''}
                onChange={(e) => setComments((c) => ({ ...c, [r.id]: e.target.value }))}
                style={{ ...input, flex: 1, minWidth: 180 }}
              />
              <button onClick={() => act(r.id, 'approve')} disabled={busyId === r.id} style={{ ...btn, background: 'var(--success)', color: '#fff' }}>
                {r.status === 'Pending Manager' ? 'Approve → HR' : 'Final Approve'}
              </button>
              <button onClick={() => reject(r.id)} disabled={busyId === r.id} style={{ ...btn, background: 'var(--surface)', color: 'var(--danger)', border: '1.5px solid var(--danger)' }}>
                Reject
              </button>
            </div>
          )}

          {isAdmin && r.status === 'Approved' && (
            <button onClick={() => act(r.id, 'start')} disabled={busyId === r.id} style={{ ...btn, background: 'var(--accent)', color: 'var(--accent-text)', alignSelf: 'flex-start' }}>
              Move to In Progress
            </button>
          )}

          {isAdmin && r.status === 'In Progress' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="number" min={0} max={r.headcount} step={1}
                placeholder={`Joined (0-${r.headcount})`}
                value={joined[r.id] ?? ''}
                onChange={(e) => setJoined((j) => ({ ...j, [r.id]: e.target.value }))}
                style={{ ...input, width: 130 }}
              />
              <input
                type="text" placeholder="Joining notes (optional)"
                value={notes[r.id] ?? ''}
                onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                style={{ ...input, flex: 1, minWidth: 160 }}
              />
              <button
                onClick={() => act(r.id, 'joined', { joined_count: Number(joined[r.id] ?? ''), joined_notes: notes[r.id] ?? '' })}
                disabled={busyId === r.id || (joined[r.id] ?? '') === ''}
                style={{ ...btn, background: 'var(--success)', color: '#fff' }}
              >
                Record Joined
              </button>
            </div>
          )}

          {isAdmin && r.status === 'Joined' && (
            <button onClick={() => act(r.id, 'close')} disabled={busyId === r.id} style={{ ...btn, background: 'var(--text)', color: '#fff', alignSelf: 'flex-start' }}>
              Close Request
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
