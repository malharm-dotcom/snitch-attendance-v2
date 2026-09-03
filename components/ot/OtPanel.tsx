'use client';

import { useState } from 'react';
import { DEPARTMENTS } from '@/lib/constants';
import OtApprovalQueue from './OtApprovalQueue';
import OtSubmitForm from './OtSubmitForm';
import OtBulkUpload from './OtBulkUpload';

type OtTab = 'queue' | 'raise' | 'import';

const TABS: { id: OtTab; label: string }[] = [
  { id: 'queue', label: 'Approvals' },
  { id: 'raise', label: 'Raise OT' },
  { id: 'import', label: 'Bulk Import' },
];

/** The manager/admin Overtime workspace. Both shells render this — identical access. */
export default function OtPanel() {
  const [tab, setTab] = useState<OtTab>('queue');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '7px 16px',
              border: '1.5px solid var(--border)',
              borderRadius: 6,
              background: tab === t.id ? 'var(--text)' : 'var(--surface)',
              color: tab === t.id ? '#fff' : 'var(--text-2)',
              fontFamily: 'var(--mono)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'queue' && <OtApprovalQueue />}
      {/* Managers and admins may raise OT for any department in their facility scope. */}
      {tab === 'raise' && <OtSubmitForm departments={DEPARTMENTS} />}
      {tab === 'import' && <OtBulkUpload />}
    </div>
  );
}
