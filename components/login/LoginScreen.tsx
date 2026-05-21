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
    if (!employeeCode.trim()) { setError('Please enter your employee code or name'); return; }
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--r)',
    fontFamily: 'var(--mono)',
    fontSize: 14,
    background: 'var(--surface2)',
    color: 'var(--text)',
    outline: 'none',
    transition: 'border-color 0.18s, box-shadow 0.18s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--mono)',
    fontSize: 11,
    color: 'var(--text-3)',
    marginBottom: 7,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 600,
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>

      {/* Brand panel */}
      <div
        className="hidden md:flex"
        style={{
          width: '44%',
          background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)',
          borderRight: '1px solid #2d2d4e',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '56px 60px',
          gap: 22,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Ambient glow blob */}
        <div style={{
          position: 'absolute',
          top: '-80px',
          left: '-80px',
          width: 340,
          height: 340,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,125,244,0.14) 0%, transparent 70%)',
          pointerEvents: 'none',
          animation: 'auraShift 16s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-60px',
          right: '-40px',
          width: 240,
          height: 240,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(82,201,139,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/favicon.png"
          alt="Snitch"
          style={{
            height: '36px',
            width: 'auto',
            objectFit: 'contain',
            filter: 'brightness(0) invert(1)',
            position: 'relative',
            animation: 'fadeIn 0.5s ease both',
          }}
        />

        <h1 style={{
          color: '#f1f5f9',
          fontFamily: 'var(--display)',
          fontWeight: 800,
          fontSize: 46,
          lineHeight: 1.06,
          margin: 0,
          letterSpacing: '-0.5px',
          position: 'relative',
          animation: 'fadeIn 0.6s 0.1s ease both',
        }}>
          Attendance<br />Management
        </h1>

        <p style={{
          color: 'rgba(255,255,255,0.38)',
          fontFamily: 'var(--mono)',
          fontSize: 13,
          margin: 0,
          lineHeight: 1.75,
          position: 'relative',
          animation: 'fadeIn 0.6s 0.2s ease both',
        }}>
          Daily attendance tracking<br />for warehouse operations.
        </p>

        {/* Decorative line */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          marginTop: 20,
          position: 'relative',
          animation: 'fadeIn 0.6s 0.3s ease both',
        }}>
          {[100, 60, 35].map((w, i) => (
            <div key={i} style={{
              width: w,
              height: 2,
              borderRadius: 2,
              background: i === 0 ? 'var(--accent)' : 'var(--border)',
              transition: 'width 0.3s ease',
            }} />
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
        position: 'relative',
      }}>
        <div style={{ width: '100%', maxWidth: 360, animation: 'slideUp 0.4s 0.05s ease both' }}>

          {/* Mobile brand label */}
          <div className="flex md:hidden" style={{
            display: 'none',
            background: 'var(--accent)',
            color: 'var(--accent-text)',
            borderRadius: 8,
            padding: '5px 12px',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            width: 'fit-content',
            marginBottom: 24,
          }}>
            Snitch Warehouse
          </div>

          <h2 style={{
            fontFamily: 'var(--display)',
            fontWeight: 800,
            fontSize: 30,
            margin: '0 0 6px',
            color: 'var(--text)',
            letterSpacing: '-0.3px',
          }}>
            Sign in
          </h2>
          <p style={{
            color: 'var(--text-3)',
            fontFamily: 'var(--mono)',
            fontSize: 12,
            margin: '0 0 32px',
            lineHeight: 1.6,
          }}>
            Employee code or name · Password / PIN
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={labelStyle}>Employee Code / Name</label>
              <input
                type="text"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
                placeholder="SAPL00264 or your name"
                autoComplete="username"
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(139,125,244,0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label style={labelStyle}>Password / PIN</label>
              <PasswordInput value={password} onChange={setPassword} onSubmit={handleLogin} />
            </div>

            {error && (
              <div style={{
                background: 'var(--danger-bg)',
                border: '1px solid rgba(240,107,107,0.25)',
                color: 'var(--danger)',
                padding: '10px 14px',
                borderRadius: 'var(--r)',
                fontFamily: 'var(--mono)',
                fontSize: 12,
                lineHeight: 1.5,
                animation: 'fadeIn 0.18s ease',
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
                letterSpacing: '0.01em',
                marginTop: 4,
                transition: 'background 0.18s, transform 0.1s, box-shadow 0.18s',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  (e.currentTarget).style.background = 'var(--accent-d)';
                  (e.currentTarget).style.boxShadow = '0 0 28px rgba(139,125,244,0.35)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget).style.background = loading ? 'var(--surface2)' : 'var(--accent)';
                (e.currentTarget).style.boxShadow = 'none';
              }}
              onMouseDown={(e) => { if (!loading) (e.currentTarget).style.transform = 'scale(0.985)'; }}
              onMouseUp={(e) => { (e.currentTarget).style.transform = 'scale(1)'; }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
