'use client';

import { useState } from 'react';

interface PinInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit?: () => void;
}

export default function PinInput({ value, onChange, onSubmit }: PinInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
        onKeyDown={(e) => { if (e.key === 'Enter' && onSubmit) onSubmit(); }}
        placeholder="Enter PIN"
        inputMode="numeric"
        style={{
          width: '100%',
          padding: '11px 44px 11px 14px',
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--r)',
          fontFamily: 'var(--mono)',
          fontSize: 18,
          letterSpacing: '0.2em',
          background: 'var(--surface)',
          color: 'var(--text)',
          outline: 'none',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-3)',
          fontSize: 14,
          fontFamily: 'var(--mono)',
          padding: 4,
        }}
      >
        {show ? 'hide' : 'show'}
      </button>
    </div>
  );
}
