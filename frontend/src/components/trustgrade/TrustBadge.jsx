import React from 'react';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function TrustBadge({
  status = 'protected', // 'protected' | 'flagged' | 'clean'
  size = 'sm', // 'sm' | 'md'
  showLabel = true,
  onClick = null,
}) {
  const isFlagged = status === 'flagged';
  const isSm = size === 'sm';

  const badgeStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: isSm ? '4px' : '6px',
    padding: isSm ? '2px 8px' : '4px 10px',
    borderRadius: '12px',
    fontSize: isSm ? '0.72rem' : '0.82rem',
    fontWeight: '600',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.15s ease',
    userSelect: 'none',
    border: isFlagged
      ? '1px solid rgba(239, 68, 68, 0.4)'
      : '1px solid rgba(16, 185, 129, 0.35)',
    background: isFlagged
      ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(185, 28, 28, 0.2))'
      : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 95, 70, 0.18))',
    color: isFlagged ? '#f87171' : '#10b981',
  };

  const IconComponent = isFlagged ? ShieldAlert : ShieldCheck;

  return (
    <span
      style={badgeStyles}
      onClick={onClick}
      title={isFlagged ? "TrustGrade: Plagiarism Flag Active" : "TrustGrade: Adversarial & Sycophancy Defenses Active"}
    >
      <IconComponent size={isSm ? 12 : 14} style={{ flexShrink: 0 }} />
      {showLabel && (
        <span>
          {isFlagged ? 'Similarity Flag' : 'TrustGrade Protected'}
        </span>
      )}
    </span>
  );
}
