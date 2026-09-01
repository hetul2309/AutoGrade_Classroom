import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4500);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  const isSuccess = type === 'success';
  const isError = type === 'error';
  const isWarning = type === 'warning';

  const borderColor = isSuccess ? '#10b981' : isError ? '#ef4444' : '#f59e0b';
  const Icon = isSuccess ? CheckCircle2 : isError ? XCircle : AlertTriangle;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 100,
        background: '#111827',
        border: `1px solid ${borderColor}`,
        boxShadow: `0 10px 25px -5px ${borderColor}33`,
        borderRadius: '12px',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        maxWidth: '420px',
        animation: 'slideUp 0.25s ease-out',
      }}
    >
      <Icon size={20} color={borderColor} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: '0.88rem', color: '#f8fafc', flexGrow: 1 }}>{message}</span>
      <button
        onClick={onClose}
        style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
