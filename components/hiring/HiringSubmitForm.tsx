'use client';

import { useState } from 'react';
import { DEPARTMENTS } from '@/lib/constants';
import { istDateString } from '@/lib/ist';
import { useToast } from '../shared/Toast';

const labelStyle: React.CSSProperties = { display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' };
const fieldStyle: React.CSSProperties = { padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontFamily: 'var(--mono)', fontSize: 13, background: 'var(--surface)', width: '100%' };

const REQ_TYPES = ['New', 'Replacement'] as const;

export default function HiringSubmitForm() {
  const today = istDateString();
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [subDepartment, setSubDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [headcount, setHeadcount] = useState('1');
  const [reqType, setReqType] = useState<(typeof REQ_TYPES)[number]>('New');
  const [expected, setExpected] = useState(today);
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  async function submit() {
    if (!position.trim() || !justification.trim()) {
      showToast('Position and justification are required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      // No facility in the body — the server stamps it from the session.
      const res = await fetch('/api/hiring/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department,
          sub_department: subDepartment.trim(),
          position: position.trim(),
          headcount: Number(headcount),
          req_type: reqType,
          expected_joining_date: expected,
          justification: justification.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Submit failed (${res.status})`);
      showToast(`Hiring request raised — ${data.request.status}`, 'success');
      setPosition('');
      setSubDepartment('');
      setJustification('');
      setHeadcount('1');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to raise hiring request', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
      <div>
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18, margin: 0 }}>Raise Hiring Request</h2>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)', margin: '6px 0 0' }}>
          Goes to your manager first, then to HR/Admin for final approval.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={labelStyle}>Department</label>
          <select value={department} onChange={(e) => setDepartment(e.target.value)} style={fieldStyle}>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          {/* Free text — not every sub-department exists in the canonical list. */}
          <label style={labelStyle}>Sub-Department (optional)</label>
          <input type="text" value={subDepartment} onChange={(e) => setSubDepartment(e.target.value)} placeholder="e.g. Packing" style={fieldStyle} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Position</label>
        <input type="text" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Picker / Executive" style={fieldStyle} />
      </div>

      <div>
        <label style={labelStyle}>Request Type</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {REQ_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setReqType(t)}
              style={{
                padding: '8px 18px', borderRadius: 'var(--r)',
                border: `1.5px solid ${reqType === t ? 'var(--text)' : 'var(--border)'}`,
                background: reqType === t ? 'var(--text)' : 'var(--surface)',
                color: reqType === t ? '#fff' : 'var(--text-2)',
                fontFamily: 'var(--mono)', fontSize: 13, cursor: 'pointer',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={labelStyle}>Headcount</label>
          <input type="number" value={headcount} min={1} max={500} step={1} onChange={(e) => setHeadcount(e.target.value)} style={fieldStyle} />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={labelStyle}>Expected Joining Date</label>
          <input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} style={fieldStyle} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Justification</label>
        <textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={4} placeholder="Why is this headcount needed?" style={{ ...fieldStyle, resize: 'vertical' }} />
      </div>

      <button
        onClick={submit}
        disabled={submitting}
        style={{ padding: '10px 20px', background: submitting ? 'var(--surface2)' : 'var(--accent)', color: submitting ? 'var(--text-3)' : 'var(--accent-text)', border: 'none', borderRadius: 'var(--r)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, cursor: submitting ? 'not-allowed' : 'pointer', alignSelf: 'flex-start' }}
      >
        {submitting ? 'Submitting…' : 'Submit Request'}
      </button>
    </div>
  );
}
