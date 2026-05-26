'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './Toast';

interface TopbarProps {
  name: string;
  role: string;
}

export default function Topbar({ name, role }: TopbarProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [showPin, setShowPin] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  async function handleLogout() {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
      router.push('/');
    } catch {
      showToast('Logout failed', 'error');
    }
  }

  async function handleChangePin() {
    if (!currentPin) { showToast('Enter your current PIN', 'error'); return; }
    if (newPin.length < 4) { showToast('New PIN must be at least 4 characters', 'error'); return; }
    if (newPin !== confirmPin) { showToast('New PINs do not match', 'error'); return; }
    setPinSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPin, new_password: newPin }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? 'Failed to change PIN', 'error'); return; }
      showToast('PIN changed successfully', 'success');
      setShowPin(false);
      setCurrentPin(''); setNewPin(''); setConfirmPin('');
    } catch {
      showToast('Network error', 'error');
    } finally {
      setPinSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1.5px solid var(--border)',
    borderRadius: 8,
    fontFamily: 'var(--mono)',
    fontSize: 14,
    background: 'var(--surface2)',
    color: 'var(--text)',
    outline: 'none',
  };

  return (
    <>
      <header style={{
        background: '#ffffff',
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
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://www.snitch.co.in/cdn/shop/files/SNITCH_LOGO_NEW_BLACK.png?v=1721457834"
            alt="Snitch"
            style={{ height: 20, width: 'auto', objectFit: 'contain' }}
          />
          <span style={{
            width: 1, height: 18,
            background: 'var(--border2)',
            display: 'inline-block',
          }} />
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 12,
            color: 'var(--text-2)',
            fontWeight: 500,
            letterSpacing: '0.04em',
          }}>
            Attendance
          </span>
          <span style={{
            background: 'var(--accent)',
            color: 'var(--accent-text)',
            fontFamily: 'var(--mono)',
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 7px',
            borderRadius: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {role}
          </span>
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)' }}>
            {name}
          </span>
          <button
            onClick={() => setShowPin(true)}
            title="Change PIN"
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 6px',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: 'var(--text-3)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)'; }}
          >
            Change PIN
          </button>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 6px',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: 'var(--text-3)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)'; }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Change PIN modal */}
      {showPin && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowPin(false); }}>
          <div className="modal-box" style={{ maxWidth: 380, padding: '28px 32px' }}>
            <h3 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18, margin: '0 0 20px' }}>
              Change PIN
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Current PIN / Password</label>
                <input type="password" value={currentPin} onChange={(e) => setCurrentPin(e.target.value)} placeholder="Your current PIN" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>New PIN</label>
                <input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="Min 4 characters" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Confirm New PIN</label>
                <input type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleChangePin(); }} placeholder="Repeat new PIN" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                <button onClick={() => { setShowPin(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); }} style={{ padding: '9px 18px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'none', fontFamily: 'var(--mono)', fontSize: 13, cursor: 'pointer', color: 'var(--text-2)' }}>
                  Cancel
                </button>
                <button onClick={handleChangePin} disabled={pinSaving} style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: pinSaving ? 'var(--surface2)' : 'var(--accent)', color: pinSaving ? 'var(--text-3)' : 'var(--accent-text)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, cursor: pinSaving ? 'not-allowed' : 'pointer' }}>
                  {pinSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
