import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export default function Toast({ message, type = 'success', duration = 4000, onClose }) {
  const [visible, setVisible] = useState(true);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        if (onCloseRef.current) onCloseRef.current();
      }, 200);
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration]);

  if (!message) return null;

  const isSuccess = type === 'success';
  const isError = type === 'error';
  const isWarning = type === 'warning';
  const isInfo = type === 'info';

  const accentColor = isSuccess
    ? '#10b981'
    : isError
    ? '#ef4444'
    : isWarning
    ? '#f59e0b'
    : 'var(--primary, #FF6A00)';

  const Icon = isSuccess
    ? CheckCircle2
    : isError
    ? XCircle
    : isWarning
    ? AlertTriangle
    : Info;

  return (
    <div
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 100000000,
        background: 'var(--modal-bg, #111827)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--border-subtle)',
        borderLeft: `4px solid ${accentColor}`,
        boxShadow: `0 12px 35px -6px rgba(0, 0, 0, 0.18), 0 0 20px ${accentColor}20`,
        borderRadius: '14px',
        padding: '14px 18px 16px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        maxWidth: '420px',
        minWidth: '300px',
        overflow: 'hidden',
        color: 'var(--text-main)',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(-14px) scale(0.95)',
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: `${accentColor}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={18} color={accentColor} />
      </div>

      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-main)' }}>
          {isSuccess ? 'Success' : isError ? 'Error' : isWarning ? 'Notice' : 'Information'}
        </div>
        <div
          style={{
            fontSize: '0.80rem',
            color: 'var(--text-muted)',
            marginTop: '2px',
            lineHeight: '1.35',
            wordBreak: 'break-word',
          }}
        >
          {message}
        </div>
      </div>

      <button
        onClick={() => {
          setVisible(false);
          setTimeout(onClose, 200);
        }}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-dim)',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-main)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; }}
        title="Dismiss"
      >
        <X size={15} />
      </button>

      {/* Toast Animated Progress Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: accentColor,
          transformOrigin: 'left',
          animation: `toast-progress ${duration}ms linear forwards`,
        }}
      />
    </div>
  );
}
