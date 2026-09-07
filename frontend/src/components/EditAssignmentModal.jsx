import React, { useState } from 'react';
import { X, Edit3, Calendar, FileUp, FileText, CheckCircle, Cpu, Sparkles } from 'lucide-react';
import { updateAssignmentApi } from '../api';

export default function EditAssignmentModal({ assignment, onClose, onUpdated }) {
  // Format existing deadline ISO string to YYYY-MM-DDTHH:mm for datetime-local input
  const formatForInput = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      const offsetMs = d.getTimezoneOffset() * 60000;
      const local = new Date(d.getTime() - offsetMs);
      return local.toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  const [title, setTitle] = useState(assignment.title || '');
  const [description, setDescription] = useState(assignment.description || '');
  const [rubricText, setRubricText] = useState(assignment.rubric_text || '');
  const [maxMarks, setMaxMarks] = useState(assignment.max_marks || 100);
  const [deadline, setDeadline] = useState(formatForInput(assignment.deadline));
  const [attachment, setAttachment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Extend deadline quick helpers
  const addDaysToDeadline = (days) => {
    try {
      const current = deadline ? new Date(deadline) : new Date();
      current.setDate(current.getDate() + days);
      const offsetMs = current.getTimezoneOffset() * 60000;
      const local = new Date(current.getTime() - offsetMs);
      setDeadline(local.toISOString().slice(0, 16));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('rubric_text', rubricText);
      formData.append('max_marks', maxMarks);
      if (deadline) {
        formData.append('deadline', new Date(deadline).toISOString());
      }
      if (attachment) {
        formData.append('attachment', attachment);
      }

      const updated = await updateAssignmentApi(assignment.id, formData);
      onUpdated(updated);
    } catch (err) {
      setError(err.message || 'Failed to update assignment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-glow)' }}>
              <Edit3 size={20} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>Edit Assignment</h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Update instructions given to students, adjust submission deadline, or refine the AI grading rubric
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px', borderRadius: '8px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div style={{ padding: '12px 16px', background: 'var(--status-flagged-bg)', border: '1px solid var(--status-flagged-border)', borderRadius: '10px', color: 'var(--status-flagged-text)', fontSize: '0.88rem' }}>
              {error}
            </div>
          )}

          {/* Quick Deadline Extensions Toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: 'var(--primary)', fontWeight: '600' }}>
              <Calendar size={16} />
              <span>Quick Extend Deadline:</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => addDaysToDeadline(1)}
                className="btn-secondary"
                style={{ fontSize: '0.78rem', padding: '5px 12px', borderRadius: '6px' }}
              >
                +1 Day
              </button>
              <button
                type="button"
                onClick={() => addDaysToDeadline(3)}
                className="btn-secondary"
                style={{ fontSize: '0.78rem', padding: '5px 12px', borderRadius: '6px' }}
              >
                +3 Days
              </button>
              <button
                type="button"
                onClick={() => addDaysToDeadline(7)}
                className="btn-secondary"
                style={{ fontSize: '0.78rem', padding: '5px 12px', borderRadius: '6px' }}
              >
                +1 Week
              </button>
            </div>
          </div>

          {/* SECTION 1: STUDENT FACING DETAILS */}
          <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '12px', borderLeft: '4px solid var(--primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <FileText size={18} color="var(--primary)" />
              <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                1. Student Materials & Problem Statement
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>
                Visible to students
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Assignment Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lab 2: Support Vector Machines & Kernels"
                  className="form-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Student Instructions & Problem Statement *
                </label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain the lab assignment objectives, problem statement, and expected deliverables to students..."
                  className="form-input"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Submission Deadline *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Maximum Marks *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(Number(e.target.value))}
                    className="form-input"
                  />
                </div>
              </div>

              {/* PDF Handout Attachment */}
              <div style={{ marginTop: '4px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Replace Attached Lab Handout / Reference PDF (Optional)
                </label>
                <div style={{
                  border: '2px dashed var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '16px',
                  textAlign: 'center',
                  background: 'var(--input-bg)',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s ease'
                }}>
                  <input
                    type="file"
                    id="edit-handout-upload"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(e) => setAttachment(e.target.files[0] || null)}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="edit-handout-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <FileUp size={22} color="var(--primary)" />
                    {attachment ? (
                      <span style={{ fontSize: '0.86rem', color: 'var(--status-graded-text)', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle size={15} /> Selected: {attachment.name} ({(attachment.size / 1024).toFixed(1)} KB)
                      </span>
                    ) : assignment.has_attachment ? (
                      <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                        Currently attached: <strong style={{ color: 'var(--text-main)' }}>{assignment.attachment_name}</strong>. Click here to upload a replacement.
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                        Click to upload a PDF or document handout for students to download
                      </span>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: LLM PROMPT & GRADING RUBRIC */}
          <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '12px', borderLeft: '4px solid var(--accent-purple)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-purple)' }}>
                <Cpu size={18} />
                <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                  2. AI Notebook Evaluator — Grading Rubric
                </h4>
              </div>
              <span className="badge badge-pending" style={{ fontSize: '0.72rem' }}>
                AI Evaluator
              </span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '12px' }}>
              Provide the exact evaluation criteria and mark allocation. This textual rubric is passed directly into the AI evaluator to score student notebooks.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                LLM Grading Rubric & Evaluation Prompt *
              </label>
              <textarea
                required
                rows={7}
                value={rubricText}
                onChange={(e) => setRubricText(e.target.value)}
                placeholder="List criteria, weights, edge cases, and expected outputs for each task..."
                className="form-input"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', lineHeight: '1.5', resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '18px' }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
              style={{ minWidth: '150px' }}
            >
              {saving ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
