'use client';

import { useState, useRef, useEffect } from 'react';

interface NameDropdownProps {
  names: string[];
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
}

export default function NameDropdown({ names, value, onChange, placeholder = 'Search name...' }: NameDropdownProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = query.trim()
    ? names.filter((n) => n.toLowerCase().includes(query.toLowerCase()))
    : names;

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  function select(name: string) {
    onChange(name);
    setQuery(name);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlighted]) select(filtered[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[highlighted] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  function highlight(text: string): React.ReactNode {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: 'var(--accent)', color: 'var(--accent-text)', padding: 0 }}>
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange(''); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          width: '100%',
          padding: '11px 14px',
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--r)',
          fontFamily: 'var(--display)',
          fontSize: 15,
          background: 'var(--surface)',
          color: 'var(--text)',
          outline: 'none',
        }}
        onFocusCapture={(e) => {
          (e.target as HTMLInputElement).style.borderColor = 'var(--accent)';
        }}
        onBlurCapture={(e) => {
          (e.target as HTMLInputElement).style.borderColor = 'var(--border)';
        }}
      />
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: 'var(--r)',
            maxHeight: 220,
            overflowY: 'auto',
            listStyle: 'none',
            padding: 4,
            margin: 0,
            zIndex: 500,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          }}
        >
          {filtered.map((name, i) => (
            <li
              key={name}
              onMouseDown={() => select(name)}
              onMouseEnter={() => setHighlighted(i)}
              style={{
                padding: '9px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: 'var(--display)',
                fontSize: 14,
                background: i === highlighted ? 'var(--surface2)' : 'transparent',
              }}
            >
              {highlight(name)}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && query.trim() && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--r)',
          padding: '12px 16px',
          fontFamily: 'var(--mono)',
          fontSize: 13,
          color: 'var(--text-3)',
          zIndex: 500,
        }}>
          No match found
        </div>
      )}
    </div>
  );
}
