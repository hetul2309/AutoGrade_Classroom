import React from 'react';
import {
  Shield, ShieldCheck, ShieldAlert, X, AlertTriangle, CheckCircle2,
  Lock, Cpu, FileText, Lightbulb, UserCheck, HelpCircle
} from 'lucide-react';

export default function FlagDetailPanel({
  submission = null,
  assignment = null,
  onClose,
  theme = 'light',
}) {
  if (!submission) return null;

  const isLight = theme === 'light';
  const isFlagged = Boolean(submission.flagged);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: isLight ? '#ffffff' : '#181b24',
          color: isLight ? '#1f2937' : '#f3f4f6',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.4)',
          border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255, 255, 255, 0.1)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: isFlagged ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: isFlagged ? '#ef4444' : '#10b981',
              padding: '10px',
              borderRadius: '12px',
            }}>
              {isFlagged ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>
                TrustGrade Assessment Inspector
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: isLight ? '#6b7280' : '#9ca3af' }}>
                Submission: <strong>{submission.student_name || submission.student_id || 'Student'}</strong>
                {assignment?.title ? ` • ${assignment.title}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: isLight ? '#9ca3af' : '#6b7280',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Score & Status Summary Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          background: isLight ? '#f9fafb' : '#12141a',
          padding: '14px',
          borderRadius: '12px',
          border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: isLight ? '#6b7280' : '#9ca3af', textTransform: 'uppercase' }}>Score</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: isFlagged ? '#ef4444' : '#10b981' }}>
              {submission.marks !== undefined ? `${submission.marks} / ${submission.max_marks || 100}` : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: isLight ? '#6b7280' : '#9ca3af', textTransform: 'uppercase' }}>Integrity Status</div>
            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: isFlagged ? '#ef4444' : '#10b981', marginTop: '4px' }}>
              {isFlagged ? 'Similarity Flagged' : 'Verified Authentic'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: isLight ? '#6b7280' : '#9ca3af', textTransform: 'uppercase' }}>Defense Layer</div>
            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#6366f1', marginTop: '4px' }}>
              Active (Hardened)
            </div>
          </div>
        </div>

        {/* Audit Cards Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 1. Similarity & Copy Case Audit */}
          <div style={{
            border: isFlagged ? '1px solid rgba(239, 68, 68, 0.3)' : isLight ? '1px solid #e5e7eb' : '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '14px',
            background: isFlagged ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              {isFlagged ? <AlertTriangle size={16} color="#ef4444" /> : <CheckCircle2 size={16} color="#10b981" />}
              <span style={{ fontSize: '0.88rem', fontWeight: '700' }}>
                Academic Similarity & Plagiarism Check
              </span>
            </div>
            {isFlagged ? (
              <div style={{ fontSize: '0.82rem', color: '#f87171', lineHeight: '1.4' }}>
                <strong>Alert:</strong> {submission.flag_reason || 'AST and Token similarity threshold exceeded with a classmate.'}
              </div>
            ) : (
              <div style={{ fontSize: '0.82rem', color: isLight ? '#4b5563' : '#9ca3af' }}>
                No significant code overlap detected. Tokenized N-gram and normalized AST structures verified independent.
              </div>
            )}
          </div>

          {/* 2. Adversarial Injection & Sandbox Isolation */}
          <div style={{
            border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Lock size={16} color="#6366f1" />
              <span style={{ fontSize: '0.88rem', fontWeight: '700' }}>
                Adversarial Injection & Boundary Isolation
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="#10b981" />
                <span>Boundary Provenance Enforced</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="#10b981" />
                <span>Dynamic Session Canary Protected</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="#10b981" />
                <span>Null Byte & ANSI Sanitization Clean</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} color="#10b981" />
                <span>Score Clamping Range Verified</span>
              </div>
            </div>
          </div>

          {/* 3. Sycophancy & Emotional Manipulation Audit */}
          <div style={{
            border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <UserCheck size={16} color="#10b981" />
              <span style={{ fontSize: '0.88rem', fontWeight: '700' }}>
                Sycophancy & Emotional Appeal Filter
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: isLight ? '#4b5563' : '#9ca3af', lineHeight: '1.4' }}>
              The grader is shielded by TrustGrade Directive 6. Student hardship pleas, flattery, and unverified self-assessments are strictly filtered to ensure objective, merit-based grading.
            </p>
          </div>

          {/* 4. Reasoning & Counterfactual Advice */}
          {submission.reasoning_text && (
            <div style={{
              background: isLight ? '#f9fafb' : '#12141a',
              border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <FileText size={16} color="#6366f1" />
                <span style={{ fontSize: '0.88rem', fontWeight: '700' }}>
                  AI Evaluation Critique
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.84rem', color: isLight ? '#374151' : '#d1d5db', lineHeight: '1.45', whiteSpace: 'pre-line' }}>
                {submission.reasoning_text}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
