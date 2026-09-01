import React, { useState } from 'react';
import { X, Save, AlertTriangle, ShieldCheck } from 'lucide-react';
import { patchGradeApi } from '../api';

export default function EditGradeModal({ gradeItem, onClose, onSaveSuccess }) {
  const [marks, setMarks] = useState(gradeItem.marks ?? 0);
  const [reasoning, setReasoning] = useState(gradeItem.reasoning_text || '');
  const [flagged, setFlagged] = useState(gradeItem.flagged || false);
  const [flagReason, setFlagReason] = useState(gradeItem.flag_reason || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!gradeItem.grade_id) {
      setError('Cannot edit: submission has not been graded yet.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await patchGradeApi(gradeItem.grade_id, {
        marks: parseFloat(marks),
        reasoning_text: reasoning,
        flagged: flagged,
        flag_reason: flagged ? flagReason : null,
      });
      onSaveSuccess(updated);
    } catch (err) {
      setError(err.message || 'Failed to save grade changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Edit Grade & Reasoning</h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Student: <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{gradeItem.student_name}</span> ({gradeItem.student_email})
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', color: '#f87171', fontSize: '0.88rem' }}>
              {error}
            </div>
          )}

          {/* Marks Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Awarded Marks (out of {gradeItem.max_marks || 100})
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                id="edit-marks-input"
                type="number"
                step="0.5"
                min="0"
                max={gradeItem.max_marks || 100}
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                className="form-input"
                style={{ width: '140px', fontWeight: '700', fontSize: '1.1rem' }}
                required
              />
              <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>/ {gradeItem.max_marks || 100} marks</span>
            </div>
          </div>

          {/* Reasoning Text */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Grading Reasoning & Feedback
            </label>
            <textarea
              id="edit-reasoning-textarea"
              rows={5}
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              className="form-input"
              style={{ resize: 'vertical', lineHeight: '1.5' }}
              placeholder="Explain why this mark was awarded..."
              required
            />
          </div>

          {/* Similarity / Plagiarism Toggle */}
          <div style={{ padding: '16px', background: flagged ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.03)', border: `1px solid ${flagged ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-subtle)'}`, borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {flagged ? <AlertTriangle size={20} color="#f87171" /> : <ShieldCheck size={20} color="#34d399" />}
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600', color: flagged ? '#f87171' : '#34d399' }}>
                    {flagged ? 'Flagged for Academic Dishonesty / Plagiarism' : 'No Plagiarism Flag'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    Flags are recorded in student audit records
                  </div>
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  id="edit-flagged-checkbox"
                  type="checkbox"
                  checked={flagged}
                  onChange={(e) => setFlagged(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#ef4444' }}
                />
              </label>
            </div>

            {flagged && (
              <div style={{ marginTop: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Plagiarism Reason / Evidence:
                </label>
                <input
                  type="text"
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  className="form-input"
                  placeholder="e.g. 95% identical to peer submission..."
                  style={{ fontSize: '0.85rem' }}
                />
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
              Cancel
            </button>
            <button id="save-grade-btn" type="submit" className="btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Saving Changes...' : 'Save Grade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
