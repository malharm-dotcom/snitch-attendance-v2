'use client';

import { useState } from 'react';
import HiringSubmitForm from './HiringSubmitForm';
import HiringQueue from './HiringQueue';

type HiringTab = 'queue' | 'raise';

interface Props {
  /** Session role — decides which action buttons render. The server re-checks every action. */
  role: string;
}

/** The Hiring workspace, rendered by the supervisor, manager and admin shells. */
export default function HiringPanel({ role }: Props) {
  const [tab, setTab] = useState<HiringTab>('queue');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {([
          { id: 'queue' as const, label: 'Requests' },
          { id: 'raise' as const, label: 'Raise Request' },
        ]).map((t) => (
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

      {tab === 'queue' ? <HiringQueue role={role} /> : <HiringSubmitForm />}
    </div>
  );
}
