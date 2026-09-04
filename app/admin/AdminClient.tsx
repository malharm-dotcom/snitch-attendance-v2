'use client';

import { useState, useEffect, useCallback } from 'react';
import { ToastProvider, useToast } from '@/components/shared/Toast';
import Topbar from '@/components/shared/Topbar';
import SessionBanner from '@/components/supervisor/SessionBanner';
import MarkAttendance from '@/components/supervisor/MarkAttendance';
import RequestCard, { type RewriteRequest } from '@/components/manager/RequestCard';
import BulkToolbar from '@/components/manager/BulkToolbar';
import TodayStatusGrid from '@/components/manager/TodayStatusGrid';
import ManagerMatrix from '@/components/manager/ManagerMatrix';
import BulkUploadTab from '@/components/manager/BulkUploadTab';
import ReportsTab from '@/components/manager/ReportsTab';
import OfflineBanner from '@/components/shared/OfflineBanner';
import SupervisorsTab from '@/components/admin/SupervisorsTab';
import EmployeesTab from '@/components/admin/EmployeesTab';
import OtPanel from '@/components/ot/OtPanel';
import HiringPanel from '@/components/hiring/HiringPanel';

type Tab = 'mark' | 'pending' | 'resolved' | 'records' | 'employees' | 'supervisors' | 'ot' | 'hiring';
type RecordsTab = 'log' | 'reports';

interface Props {
  supervisorName: string;
  facility: string;
  allFacilities: boolean;
  department: string;
  departments: string[];
  role: string;
}

function AdminInner({ supervisorName, facility, allFacilities, department: initialDept, departments, role }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('mark');
  const [shift, setShift] = useState<'Day' | 'Night'>('Day');
  const [currentDept, setCurrentDept] = useState('');
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [requests, setRequests] = useState<RewriteRequest[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [logView, setLogView] = useState<'daily' | 'matrix'>('daily');
  const [recordsTab, setRecordsTab] = useState<RecordsTab>('log');
  const { showToast } = useToast();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'mark', label: 'Mark Attendance' },
    { id: 'pending', label: 'Pending Requests' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'records', label: 'Records' },
    { id: 'employees', label: 'Employees' },
    { id: 'supervisors', label: 'Supervisors' },
    { id: 'ot', label: 'Overtime' },
    { id: 'hiring', label: 'Hiring' },
  ];

  const loadRequests = useCallback(async (status?: string) => {
    const q = status ? `?status=${status}` : '';
    const res = await fetch(`/api/rewrite/list${q}`);
    const data = await res.json();
    setRequests(data.requests ?? []);
  }, []);

  // Pre-fetch pending count on mount so the badge is visible without navigating to the tab
  useEffect(() => {
    loadRequests('pending');
  }, [loadRequests]);

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
      <Topbar name={supervisorName} role="admin" facility={facility} allFacilities={allFacilities} allowAggregate />
      <SessionBanner
        name={supervisorName}
        facility={facility}
        department={currentDept}
        departments={departments}
        role="admin"
        shift={shift}
        onShiftChange={setShift}
        onDepartmentChange={setCurrentDept}
        employeesLoaded={employeesLoaded}
      />

      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '0 20px', display: 'flex', gap: 0, overflowX: 'auto' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '13px 16px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2.5px solid var(--accent)' : '2.5px solid transparent',
              background: 'none',
              fontFamily: 'var(--display)',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--text)' : 'var(--text-3)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
            {tab.id === 'pending' && pendingRequests.length > 0 && (
              <span style={{ marginLeft: 5, background: 'var(--accent)', color: 'var(--accent-text)', fontFamily: 'var(--mono)', fontSize: 10, padding: '1px 5px', borderRadius: 20, fontWeight: 700 }}>
                {pendingRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
        {activeTab === 'mark' && (
          <div className="tab-panel">
            <MarkAttendance supervisorName={supervisorName} facility={facility} departments={[currentDept]} shift={shift} />
          </div>
        )}
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
              <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>No pending requests</div>
            )}
            {pendingRequests.map((r) => (
              <RequestCard key={r.request_id} request={r} selected={selected.has(r.request_id)} onToggleSelect={toggleSelect} onAction={handleAction} showCheckbox currentUser={supervisorName} />
            ))}
          </div>
        )}
        {activeTab === 'resolved' && (
          <div className="tab-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {resolvedRequests.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>No resolved requests</div>
            )}
            {resolvedRequests.map((r) => <RequestCard key={r.request_id} request={r} />)}
          </div>
        )}
        {activeTab === 'records' && (
          <div className="tab-panel" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['log', 'reports'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setRecordsTab(v)}
                  style={{
                    padding: '7px 16px',
                    border: '1.5px solid var(--border)',
                    borderRadius: 6,
                    background: recordsTab === v ? 'var(--text)' : 'var(--surface)',
                    color: recordsTab === v ? '#fff' : 'var(--text-2)',
                    fontFamily: 'var(--mono)',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {v === 'log' ? 'Attendance Log' : 'Reports'}
                </button>
              ))}
            </div>

            {recordsTab === 'log' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['daily', 'matrix'] as const).map((v) => (
                    <button key={v} onClick={() => setLogView(v)} style={{ padding: '7px 16px', border: '1.5px solid var(--border)', borderRadius: 6, background: logView === v ? 'var(--text)' : 'var(--surface)', color: logView === v ? '#fff' : 'var(--text-2)', fontFamily: 'var(--mono)', fontSize: 13, cursor: 'pointer' }}>
                      {v === 'matrix' ? 'Employee View' : 'Daily'}
                    </button>
                  ))}
                </div>
                {logView === 'daily' ? <TodayStatusGrid facility={facility} /> : <ManagerMatrix allFacilities={allFacilities} />}
              </div>
            )}
            {recordsTab === 'reports' && <ReportsTab facility={facility} />}
          </div>
        )}
        {activeTab === 'employees' && <div className="tab-panel"><EmployeesTab /></div>}
        {activeTab === 'supervisors' && <div className="tab-panel"><SupervisorsTab /></div>}
        {/* Same OT workspace the manager shell renders — identical access. */}
        {activeTab === 'ot' && <div className="tab-panel"><OtPanel /></div>}
        {activeTab === 'hiring' && <div className="tab-panel"><HiringPanel role="admin" /></div>}
      </main>
    </>
  );
}

export default function AdminClient(props: Props) {
  return (
    <ToastProvider>
      <AdminInner {...props} />
    </ToastProvider>
  );
}
