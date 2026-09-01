import React from 'react';
import { X, AlertTriangle, GitCompare, CheckCircle2 } from 'lucide-react';

export default function SimilarityFlagModal({ gradeItem, onClose }) {
  if (!gradeItem) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={18} color="#f87171" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#f87171' }}>Plagiarism Detection Report</h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                Submission #{gradeItem.submission_id} • {gradeItem.student_name}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Status Alert */}
          <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px' }}>
            <div style={{ fontSize: '0.92rem', fontWeight: '700', color: '#f87171', marginBottom: '6px' }}>
              High Code Similarity Detected
            </div>
            <div style={{ fontSize: '0.86rem', color: '#fca5a5', lineHeight: '1.5' }}>
              {gradeItem.flag_reason || 'Dual-engine token and AST structural comparison detected strong similarity with one or more peer submissions.'}
            </div>
          </div>

          {/* Key Detection Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
            <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Detection Method
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)', marginTop: '4px' }}>
                Token N-Gram + AST Jaccard
              </div>
            </div>

            <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Action Status
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#f87171', marginTop: '4px' }}>
                Flagged for TA Review
              </div>
            </div>
          </div>

          {/* Explanation guidance */}
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.5', background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '10px' }}>
            <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>TA Recommendation:</span> The AST normalizer renames all variables to canonical placeholders, confirming that variable renaming or comment modifications did not conceal the shared algorithmic structure. You may manually edit or clear this flag via the "Edit Grade" button.
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button onClick={onClose} className="btn-secondary">
              Close Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
