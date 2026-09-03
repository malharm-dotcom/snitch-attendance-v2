'use client';

import { useState } from 'react';
import { ToastProvider } from '@/components/shared/Toast';
import Topbar from '@/components/shared/Topbar';
import SessionBanner from '@/components/supervisor/SessionBanner';
import MarkAttendance from '@/components/supervisor/MarkAttendance';
import HistoryPanel from '@/components/supervisor/HistoryPanel';
import OtSubmitForm from '@/components/ot/OtSubmitForm';
import OfflineBanner from '@/components/shared/OfflineBanner';

interface Props {
  supervisorName: string;
  facility: string;
  allFacilities: boolean;
  department: string;
  departments: string[];
  role: string;
}

export default function SupervisorClient({ supervisorName, facility, allFacilities, department, departments, role }: Props) {
  const [activeTab, setActiveTab] = useState<'mark' | 'history' | 'ot'>('mark');
  const [shift, setShift] = useState<'Day' | 'Night'>('Day');
  const [employeesLoaded, setEmployeesLoaded] = useState(false);

  const tabs = [
    { id: 'mark', label: 'Mark Attendance' },
    { id: 'history', label: 'History' },
    { id: 'ot', label: 'Overtime' },
  ] as const;

  return (
    <ToastProvider>
      <OfflineBanner />
      {/* Supervisors mark attendance only — no cross-facility aggregate option. */}
      <Topbar name={supervisorName} role={role} facility={facility} allFacilities={allFacilities} />
      <SessionBanner
        name={supervisorName}
        facility={facility}
        department={department}
        departments={departments}
        role={role}
        shift={shift}
        onShiftChange={setShift}
        employeesLoaded={employeesLoaded}
      />

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '0 20px', display: 'flex', gap: 0 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '14px 20px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2.5px solid var(--accent)' : '2.5px solid transparent',
              background: 'none',
              fontFamily: 'var(--display)',
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--text)' : 'var(--text-3)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>
        {activeTab === 'mark' && (
          <div className="tab-panel">
            <MarkAttendance
              supervisorName={supervisorName}
              facility={facility}
              departments={departments}
              shift={shift}
            />
          </div>
        )}
        {activeTab === 'history' && (
          <div className="tab-panel">
            <HistoryPanel departments={departments} />
          </div>
        )}
        {activeTab === 'ot' && (
          <div className="tab-panel">
            <OtSubmitForm departments={departments} />
          </div>
        )}
      </main>
    </ToastProvider>
  );
}
