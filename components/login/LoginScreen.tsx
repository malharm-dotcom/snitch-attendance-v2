'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NameDropdown from './NameDropdown';
import PinInput from './PinInput';
import { useToast } from '../shared/Toast';

interface LoginScreenProps {
  sessionExpired?: boolean;
}

export default function LoginScreen({ sessionExpired }: LoginScreenProps) {
  const [role, setRole] = useState<'supervisor' | 'manager'>('supervisor');
  const [names, setNames] = useState<string[]>([]);
  const [selectedName, setSelectedName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    if (sessionExpired) showToast('Session expired — please log in again', 'info');
  }, [sessionExpired, showToast]);

  useEffect(() => {
    setSelectedName('');
    setPin('');
    setError('');
    const q = role === 'manager' ? '?role=manager' : '';
    fetch(`/api/supervisors${q}`)
      .then((r) => r.json())
      .then((d) => setNames(d.supervisors ?? []))
      .catch(() => setNames([]));
  }, [role]);

  async function handleLogin() {
    if (!selectedName) { setError('Please select your name'); return; }
    if (!pin) { setError('Please enter your PIN'); return; }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisor_name: selectedName, pin }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Login failed');
        return;
      }

      if (data.role === 'manager') router.push('/manager');
      else if (data.role === 'admin') router.push('/admin');
      else router.push('/supervisor');
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--bg)',
    }}>
      {/* Brand panel */}
      <div style={{
        width: '45%',
        background: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '48px 56px',
        gap: 16,
      }}
        className="hidden md:flex"
      >
        <div style={{
          background: 'var(--accent)',
          color: 'var(--accent-text)',
          borderRadius: 10,
          padding: '8px 14px',
          fontFamily: 'var(--mono)',
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          Snitch Warehouse
        </div>
        <h1 style={{
          color: '#fff',
          fontFamily: 'var(--display)',
          fontWeight: 800,
          fontSize: 42,
          lineHeight: 1.1,
          margin: 0,
        }}>
          Attendance<br />Management
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.5)',
          fontFamily: 'var(--mono)',
          fontSize: 13,
          margin: 0,
          lineHeight: 1.6,
        }}>
          Daily attendance tracking<br />
          for warehouse operations.
        </p>
      </div>

      {/* Form panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h2 style={{
            fontFamily: 'var(--display)',
            fontWeight: 800,
            fontSize: 26,
            margin: '0 0 8px',
          }}>
            Sign in
          </h2>
          <p style={{ color: 'var(--text-2)', fontFamily: 'var(--mono)', fontSize: 13, margin: '0 0 28px' }}>
            Use your name and PIN to access the system
          </p>

          {/* Role toggle */}
          <div style={{
            display: 'flex',
            background: 'var(--surface2)',
            borderRadius: 'var(--r)',
            padding: 3,
            marginBottom: 24,
          }}>
            {(['supervisor', 'manager'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  border: 'none',
                  borderRadius: 8,
                  fontFamily: 'var(--display)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: role === r ? 'var(--surface)' : 'transparent',
                  color: role === r ? 'var(--text)' : 'var(--text-2)',
                  boxShadow: role === r ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s',
                  textTransform: 'capitalize',
                }}
              >
                {r}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Name
              </label>
              <NameDropdown
                names={names}
                value={selectedName}
                onChange={setSelectedName}
                placeholder="Search your name..."
              />
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                PIN
              </label>
              <PinInput value={pin} onChange={setPin} onSubmit={handleLogin} />
            </div>

            {error && (
              <div style={{
                background: '#fde2e2',
                color: 'var(--danger)',
                padding: '10px 14px',
                borderRadius: 8,
                fontFamily: 'var(--mono)',
                fontSize: 13,
              }}>
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                background: loading ? 'var(--surface2)' : 'var(--accent)',
                color: loading ? 'var(--text-3)' : 'var(--accent-text)',
                border: 'none',
                borderRadius: 'var(--r)',
                fontFamily: 'var(--display)',
                fontSize: 15,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
                marginTop: 4,
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
