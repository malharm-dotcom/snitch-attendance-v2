'use client';

import { useState } from 'react';

interface PasswordInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
}

export default function PasswordInput({ value, onChange, onSubmit, placeholder = 'Enter password' }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && onSubmit) onSubmit(); }}
        placeholder={placeholder}
        autoComplete="current-password"
        style={{
          width: '100%',
          padding: '11px 52px 11px 14px',
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
          fontSize: 12,
          fontFamily: 'var(--mono)',
          padding: '4px 6px',
          userSelect: 'none',
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'var(--text-2)'; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'var(--text-3)'; }}
      >
        {show ? 'hide' : 'show'}
      </button>
    </div>
  );
}
