'use client';

import { useRouter } from 'next/navigation';
import { useToast } from './Toast';

interface TopbarProps {
  name: string;
  role: string;
}

export default function Topbar({ name, role }: TopbarProps) {
  const router = useRouter();
  const { showToast } = useToast();

  async function handleLogout() {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
      router.push('/');
    } catch {
      showToast('Logout failed', 'error');
    }
  }

  return (
    <header style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 20px',
      height: 52,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontFamily: 'var(--display)',
          fontWeight: 800,
          fontSize: 17,
          letterSpacing: '-0.5px',
        }}>
          Snitch Attendance
        </span>
        <span style={{
          background: 'var(--accent)',
          color: 'var(--accent-text)',
          fontFamily: 'var(--mono)',
          fontSize: 10,
          fontWeight: 500,
          padding: '2px 8px',
          borderRadius: 20,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {role}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-2)' }}>
          {name}
        </span>
        <button
          onClick={handleLogout}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '5px 12px',
            fontFamily: 'var(--mono)',
            fontSize: 12,
            color: 'var(--text-2)',
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}
