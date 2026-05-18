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

  const colors: Record<ToastType, { bg: string; color: string }> = {
    success: { bg: 'var(--success)', color: '#fff' },
    error: { bg: 'var(--danger)', color: '#fff' },
    info: { bg: 'var(--text)', color: '#fff' },
  };

  const { bg, color } = colors[toast.type];

  return (
    <div
      onClick={onClose}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: bg,
        color,
        padding: '10px 16px',
        borderRadius: 'var(--r)',
        fontFamily: 'var(--mono)',
        fontSize: 13,
        cursor: 'pointer',
        minWidth: 240,
        maxWidth: 380,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.2s, transform 0.2s',
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
