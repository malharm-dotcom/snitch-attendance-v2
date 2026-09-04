'use client';

import { useCallback, useEffect, useState } from 'react';
import { istDateString } from '@/lib/ist';
import { scopeSlug, reportFilename } from '@/lib/reportExport';
import { useToast } from '../shared/Toast';
import type { HiringRow } from './HiringQueue';

interface SummaryData {
  scope: string;
  cards: {
    total: number; pendingApprovals: number; approved: number; inProgress: number;
    openPositions: number; joined: number; rejected: number; closed: number;
  };
  byDepartment: { department: string; openHeadcount: number; requests: number }[];
}

const CARDS: { key: keyof SummaryData['cards']; label: string; color?: string }[] = [
  { key: 'total', label: 'Total Requests' },
  { key: 'pendingApprovals', label: 'Pending Approvals', color: 'var(--warn)' },
  { key: 'approved', label: 'Approved', color: 'var(--success)' },
  { key: 'inProgress', label: 'In Progress', color: 'var(--accent)' },
  { key: 'openPositions', label: 'Open Positions', color: 'var(--warn)' },
  { key: 'joined', label: 'Joined', color: 'var(--success)' },
  { key: 'rejected', label: 'Rejected', color: 'var(--danger)' },
  { key: 'closed', label: 'Closed', color: 'var(--text-3)' },
];

interface Props {
  facility: string;
}

export default function HiringSummary({ facility }: Props) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hiring/summary');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load summary');
      setData(json);
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to load summary', 'error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  /** CSV of the request LIST (not the cards) — status plus the full approval trail. */
  async function exportCsv() {
    setExporting(true);
    try {
      const res = await fetch('/api/hiring/list');
      const json = await res.json();
      const rows: HiringRow[] = json.requests ?? [];
      if (!rows.length) {
        showToast('No requests to export', 'info');
        return;
      }
      const headers = [
        'ID', 'Department', 'Sub-Department', 'Position', 'Req Type', 'Headcount',
        'Facility', 'Expected Joining Date', 'Status', 'Raised By',
        'Manager Approved By', 'HR/Admin Approved By', 'Rejection Reason',
        'Joined Count', 'Open Positions', 'Joining Notes',
      ];
      const body = rows.map((r) => [
        r.id, r.department, r.sub_department ?? '', r.position, r.req_type, r.headcount,
        r.facility, r.expected_joining_date, r.status, r.requested_by,
        r.mgr_approved_by ?? '', r.admin_approved_by ?? '', r.rejection_reason ?? '',
        r.joined_count,
        // Only Approved / In Progress rows still carry unfilled demand.
        ['Approved', 'In Progress'].includes(r.status) ? r.headcount - r.joined_count : 0,
        r.joined_notes ?? '',
      ]);
      const csv = [headers, ...body]
        .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = reportFilename('hiring-requests', scopeSlug(facility), istDateString(), 'csv');
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 78, borderRadius: 'var(--r)' }} />)}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)' }}>Scope: {data.scope}</span>
        <button
          onClick={exportCsv}
          disabled={exporting}
          style={{ padding: '7px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 12, cursor: exporting ? 'wait' : 'pointer', background: 'var(--surface)' }}
        >
          &darr; {exporting ? 'Exporting…' : 'Download CSV'}
        </button>
      </div>

      {/* Count cards — plain CSS grid, no charting library. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {CARDS.map((c) => (
          <div key={c.key} style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', padding: '14px 16px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-2)' }}>
              {c.label}
            </div>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 26, marginTop: 6, color: c.color ?? 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              {data.cards[c.key]}
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15, margin: '0 0 4px' }}>Department-wise Requirement</h3>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)', margin: '0 0 10px' }}>
          Open headcount = headcount &minus; joined, across Approved and In Progress requests.
        </p>
        {data.byDepartment.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
            No open requirement
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1.5px solid var(--border)', borderRadius: 'var(--r)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--mono)' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', color: 'var(--text-2)' }}>Department</th>
                  <th style={{ padding: '9px 14px', textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: 'var(--text-2)' }}>Open Requests</th>
                  <th style={{ padding: '9px 14px', textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: 'var(--text-2)' }}>Open Headcount</th>
                </tr>
              </thead>
              <tbody>
                {data.byDepartment.map((d) => (
                  <tr key={d.department} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 14px' }}>{d.department}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.requests}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: d.openHeadcount > 0 ? 'var(--warn)' : 'var(--text-3)' }}>
                      {d.openHeadcount}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                  <td style={{ padding: '8px 14px', fontWeight: 700 }}>Total</td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {data.byDepartment.reduce((a, d) => a + d.requests, 0)}
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {data.byDepartment.reduce((a, d) => a + d.openHeadcount, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
