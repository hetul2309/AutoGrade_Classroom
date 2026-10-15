import React, { useState } from 'react';
import { Lightbulb, Shield, AlertTriangle, ChevronDown, ChevronUp, Sparkles, Eye } from 'lucide-react';
import TrustBadge from './TrustBadge';

export default function ReasoningView({
  reasoning = '',
  flagged = false,
  flagReason = null,
  isNoSub = false,
  onInspectSecurity = null,
}) {
  const [expanded, setExpanded] = useState(false);

  if (!reasoning) {
    return <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Awaiting grading</span>;
  }

  // Parse out counterfactual hint if present
  let mainReasoning = reasoning;
  let counterfactualHint = null;

  const hintMarker = '💡 What would raise this grade:';
  const hintIndex = reasoning.indexOf(hintMarker);

  if (hintIndex !== -1) {
    mainReasoning = reasoning.substring(0, hintIndex).trim();
    counterfactualHint = reasoning.substring(hintIndex + hintMarker.length).trim();
  } else {
    // Check alternative markers
    const altMarker = 'What would raise this grade:';
    const altIndex = reasoning.indexOf(altMarker);
    if (altIndex !== -1) {
      mainReasoning = reasoning.substring(0, altIndex).trim();
      counterfactualHint = reasoning.substring(altIndex + altMarker.length).trim();
    }
  }

  const isLong = mainReasoning.length > 180;
  const displayedText = isLong && !expanded ? mainReasoning.slice(0, 180) + '...' : mainReasoning;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Top Header: TrustBadge & Flags */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <TrustBadge
          status={flagged ? 'flagged' : 'protected'}
          onClick={onInspectSecurity}
        />

        {onInspectSecurity && (
          <button
            type="button"
            onClick={onInspectSecurity}
            title="Inspect TrustGrade security audits, canary protection, and similarity checks"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              fontWeight: '500',
              padding: '2px 4px',
              borderRadius: '4px',
            }}
          >
            <Eye size={12} />
            <span>Audit</span>
          </button>
        )}
      </div>

      {/* Flag Alert if applicable */}
      {flagged && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
          padding: '4px 8px',
          borderRadius: '6px',
          fontSize: '0.74rem',
          fontWeight: '700',
        }}>
          <AlertTriangle size={12} style={{ flexShrink: 0 }} />
          <span>Similarity Flagged: Zero credit awarded for code match</span>
        </div>
      )}

      {/* Main Critique Text */}
      <div style={{
        fontSize: '0.84rem',
        color: isNoSub ? '#f87171' : flagged ? '#fca5a5' : 'var(--text-bright)',
        lineHeight: '1.45',
        whiteSpace: 'pre-line',
      }}>
        {displayedText}
      </div>

      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-primary, #6366f1)',
            cursor: 'pointer',
            fontSize: '0.74rem',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
            padding: 0,
            alignSelf: 'flex-start',
          }}
        >
          {expanded ? (
            <>Less <ChevronUp size={12} /></>
          ) : (
            <>Read more <ChevronDown size={12} /></>
          )}
        </button>
      )}

      {/* Actionable Counterfactual Hint Card */}
      {counterfactualHint && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '8px',
          padding: '6px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.72rem',
            fontWeight: '700',
            color: '#fbbf24',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}>
            <Lightbulb size={12} />
            <span>What would raise this grade</span>
          </div>
          <div style={{
            fontSize: '0.78rem',
            color: '#fef3c7',
            lineHeight: '1.35',
          }}>
            {counterfactualHint}
          </div>
        </div>
      )}

      {/* Flag Reason Details */}
      {flagReason && flagReason !== reasoning && (
        <div style={{
          fontSize: '0.76rem',
          color: 'var(--text-dim)',
          background: 'rgba(0, 0, 0, 0.25)',
          padding: '6px 10px',
          borderRadius: '6px',
        }}>
          <strong>Flag Details:</strong> {flagReason}
        </div>
      )}
    </div>
  );
}
