'use client';

import { useEffect, useState, createContext, useContext, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const remove = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const icons: Record<ToastType, string> = {
    success: '✓',
    error: '✗',
    info: 'ℹ',
  };

  const colors: Record<ToastType, { bg: string; color: string; border: string }> = {
    success: { bg: 'var(--success-bg)', color: 'var(--success)', border: 'rgba(82,201,139,0.3)' },
    error:   { bg: 'var(--danger-bg)',  color: 'var(--danger)',  border: 'rgba(240,107,107,0.3)' },
    info:    { bg: 'var(--surface2)',   color: 'var(--text)',    border: 'var(--border2)' },
  };

  const { bg, color, border } = colors[toast.type];

  return (
    <div
      onClick={onClose}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: bg,
        color,
        border: `1px solid ${border}`,
        padding: '11px 16px',
        borderRadius: 'var(--r)',
        fontFamily: 'var(--mono)',
        fontSize: 13,
        cursor: 'pointer',
        minWidth: 240,
        maxWidth: 380,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(8px)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(20px)',
        transition: 'opacity 0.22s ease, transform 0.22s ease',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 15 }}>{icons[toast.type]}</span>
      <span>{toast.message}</span>
    </div>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
