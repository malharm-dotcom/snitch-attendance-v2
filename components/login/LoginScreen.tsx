'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PasswordInput from './PasswordInput';
import { useToast } from '../shared/Toast';

interface LoginScreenProps {
  sessionExpired?: boolean;
}

export default function LoginScreen({ sessionExpired }: LoginScreenProps) {
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    if (sessionExpired) showToast('Session expired — please log in again', 'info');
  }, [sessionExpired, showToast]);

  async function handleLogin() {
    if (!employeeCode.trim()) { setError('Please enter your employee code'); return; }
    if (!password) { setError('Please enter your password'); return; }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_code: employeeCode.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Login failed');
        return;
      }

      if (data.role === 'admin') router.push('/admin');
      else if (data.role === 'manager') router.push('/manager');
      else router.push('/supervisor');
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>
      {/* Brand panel — hidden on mobile */}
      <div
        className="hidden md:flex"
        style={{
          width: '45%',
          background: 'var(--text)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '48px 56px',
          gap: 20,
        }}
      >
        <div style={{
          background: 'var(--accent)',
          color: 'var(--accent-text)',
          borderRadius: 8,
          padding: '7px 14px',
          fontFamily: 'var(--mono)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          Snitch Warehouse
        </div>
        <h1 style={{
          color: '#fff',
          fontFamily: 'var(--display)',
          fontWeight: 800,
          fontSize: 44,
          lineHeight: 1.05,
          margin: 0,
        }}>
          Attendance<br />Management
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.45)',
          fontFamily: 'var(--mono)',
          fontSize: 13,
          margin: 0,
          lineHeight: 1.7,
        }}>
          Daily attendance tracking<br />for warehouse operations.
        </p>

        {/* Decorative dots */}
        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === 1 ? 'var(--accent)' : 'rgba(255,255,255,0.2)' }} />
          ))}
        </div>
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
          {/* Mobile brand label */}
          <div className="flex md:hidden" style={{
            display: 'none',
            background: 'var(--accent)',
            color: 'var(--accent-text)',
            borderRadius: 8,
            padding: '6px 12px',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            width: 'fit-content',
            marginBottom: 20,
          }}>
            Snitch Warehouse
          </div>

          <h2 style={{
            fontFamily: 'var(--display)',
            fontWeight: 800,
            fontSize: 28,
            margin: '0 0 8px',
            color: 'var(--text)',
          }}>
            Sign in
          </h2>
          <p style={{
            color: 'var(--text-2)',
            fontFamily: 'var(--mono)',
            fontSize: 13,
            margin: '0 0 32px',
            lineHeight: 1.5,
          }}>
            Use your employee code and password to access the system.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{
                display: 'block',
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--text-2)',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                fontWeight: 500,
              }}>
                Employee Code
              </label>
              <input
                type="text"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
                placeholder="e.g. SAPL00264"
                autoComplete="username"
                autoCapitalize="characters"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r)',
                  fontFamily: 'var(--mono)',
                  fontSize: 15,
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--text-2)',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                fontWeight: 500,
              }}>
                Password
              </label>
              <PasswordInput value={password} onChange={setPassword} onSubmit={handleLogin} />
            </div>

            {error && (
              <div style={{
                background: '#fde2e2',
                color: 'var(--danger)',
                padding: '10px 14px',
                borderRadius: 8,
                fontFamily: 'var(--mono)',
                fontSize: 13,
                lineHeight: 1.4,
                animation: 'fadeIn 0.15s ease',
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
                transition: 'background 0.15s, transform 0.1s',
                marginTop: 4,
              }}
              onMouseEnter={(e) => { if (!loading) (e.target as HTMLElement).style.background = 'var(--accent-d)'; }}
              onMouseLeave={(e) => { if (!loading) (e.target as HTMLElement).style.background = 'var(--accent)'; }}
              onMouseDown={(e) => { if (!loading) (e.target as HTMLElement).style.transform = 'scale(0.99)'; }}
              onMouseUp={(e) => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
