'use client';

import { useState, useEffect, useCallback } from 'react';
import { ToastProvider, useToast } from '@/components/shared/Toast';
import Topbar from '@/components/shared/Topbar';
import RequestCard, { type RewriteRequest } from '@/components/manager/RequestCard';
import BulkToolbar from '@/components/manager/BulkToolbar';
import TodayStatusGrid from '@/components/manager/TodayStatusGrid';
import ManagerMatrix from '@/components/manager/ManagerMatrix';
import OfflineBanner from '@/components/shared/OfflineBanner';
import BulkUploadTab from '@/components/manager/BulkUploadTab';
import ReportsTab from '@/components/manager/ReportsTab';

type Tab = 'pending' | 'resolved' | 'log' | 'employees' | 'reports';

interface Props {
  supervisorName: string;
  facility: string;
  department: string;
  departments: string[];
  role: string;
}

function ManagerInner({ supervisorName, facility, role }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [requests, setRequests] = useState<RewriteRequest[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [logView, setLogView] = useState<'daily' | 'matrix'>('daily');
  const { showToast } = useToast();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'pending', label: 'Pending' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'log', label: 'Attendance Log' },
    { id: 'employees', label: 'Employees' },
    { id: 'reports', label: 'Reports' },
  ];

  const loadRequests = useCallback(async (status?: string) => {
    const q = status ? `?status=${status}` : '';
    const res = await fetch(`/api/rewrite/list${q}`);
    const data = await res.json();
    setRequests(data.requests ?? []);
  }, []);

  useEffect(() => {
    if (activeTab === 'pending') loadRequests('pending');
    else if (activeTab === 'resolved') loadRequests();
  }, [activeTab, loadRequests]);

  async function handleAction(id: number, action: 'approve' | 'reject') {
    try {
      await fetch('/api/rewrite/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: id, action }),
      });
      showToast(`Request ${action}d`, 'success');
      loadRequests(activeTab === 'pending' ? 'pending' : undefined);
    } catch {
      showToast('Action failed', 'error');
    }
  }

  async function handleBulkAction(action: 'approve' | 'reject') {
    const ids = Array.from(selected);
    if (!ids.length) return;
    try {
      await fetch('/api/rewrite/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: ids[0], request_ids: ids, action }),
      });
      showToast(`${ids.length} request(s) ${action}d`, 'success');
      setSelected(new Set());
      loadRequests('pending');
    } catch {
      showToast('Bulk action failed', 'error');
    }
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pendingRequests = requests.filter((r) => r.request_status === 'pending');
  const resolvedRequests = requests.filter((r) => r.request_status !== 'pending');

  return (
    <>
      <OfflineBanner />
      <Topbar name={supervisorName} role={role} />

      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '0 20px', display: 'flex', gap: 0, overflowX: 'auto' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '14px 18px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2.5px solid var(--accent)' : '2.5px solid transparent',
              background: 'none',
              fontFamily: 'var(--display)',
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? 'var(--text)' : 'var(--text-2)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
            {tab.id === 'pending' && pendingRequests.length > 0 && (
              <span style={{ marginLeft: 6, background: 'var(--accent)', color: 'var(--accent-text)', fontFamily: 'var(--mono)', fontSize: 10, padding: '1px 6px', borderRadius: 20, fontWeight: 700 }}>
                {pendingRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
        {/* Pending tab */}
        {activeTab === 'pending' && (
          <div className="tab-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <BulkToolbar
              selectedCount={selected.size}
              totalCount={pendingRequests.length}
              onSelectAll={() => setSelected(new Set(pendingRequests.map((r) => r.request_id)))}
              onDeselectAll={() => setSelected(new Set())}
              onBulkApprove={() => handleBulkAction('approve')}
              onBulkReject={() => handleBulkAction('reject')}
            />
            {pendingRequests.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
                No pending requests
              </div>
            )}
            {pendingRequests.map((r) => (
              <RequestCard
                key={r.request_id}
                request={r}
                selected={selected.has(r.request_id)}
                onToggleSelect={toggleSelect}
                onAction={handleAction}
                showCheckbox
                currentUser={supervisorName}
              />
            ))}
          </div>
        )}

        {/* Resolved tab */}
        {activeTab === 'resolved' && (
          <div className="tab-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {resolvedRequests.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
                No resolved requests
              </div>
            )}
            {resolvedRequests.map((r) => (
              <RequestCard key={r.request_id} request={r} />
            ))}
          </div>
        )}

        {/* Attendance log tab */}
        {activeTab === 'log' && (
          <div className="tab-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['daily', 'matrix'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setLogView(v)}
                  style={{
                    padding: '7px 16px',
                    border: '1.5px solid var(--border)',
                    borderRadius: 8,
                    background: logView === v ? 'var(--text)' : 'var(--surface)',
                    color: logView === v ? '#fff' : 'var(--text-2)',
                    fontFamily: 'var(--mono)',
                    fontSize: 13,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
            {logView === 'daily' ? (
              <TodayStatusGrid facility={facility} />
            ) : (
              <ManagerMatrix facility={facility} />
            )}
          </div>
        )}

        {activeTab === 'employees' && <div className="tab-panel"><BulkUploadTab /></div>}
        {activeTab === 'reports' && <div className="tab-panel"><ReportsTab facility={facility} /></div>}
      </main>
    </>
  );
}

export default function ManagerClient(props: Props) {
  return (
    <ToastProvider>
      <ManagerInner {...props} />
    </ToastProvider>
  );
}
