import React, { useState } from 'react';
import { X, Edit3, Calendar, FileUp, FileText, CheckCircle, ShieldAlert, Cpu, Sparkles } from 'lucide-react';
import { updateAssignmentApi } from '../api';

export default function EditAssignmentModal({ assignment, onClose, onUpdated }) {
  // Format existing deadline ISO string to YYYY-MM-DDTHH:mm for datetime-local input
  const formatForInput = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      // Local time slice
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
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '740px' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Edit3 size={20} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Edit Assignment & Extend Deadline</h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                Update instructions given to students, extend submission deadline, or tweak LLM prompt
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', color: '#f87171', fontSize: '0.88rem' }}>
              {error}
            </div>
          )}

          {/* Quick Deadline Extensions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: '#fbbf24', fontWeight: '600' }}>
              <Calendar size={16} /> Quick Extend Deadline:
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" onClick={() => addDaysToDeadline(1)} className="btn-ghost" style={{ fontSize: '0.78rem', padding: '4px 10px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                +1 Day
              </button>
              <button type="button" onClick={() => addDaysToDeadline(3)} className="btn-ghost" style={{ fontSize: '0.78rem', padding: '4px 10px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                +3 Days
              </button>
              <button type="button" onClick={() => addDaysToDeadline(7)} className="btn-ghost" style={{ fontSize: '0.78rem', padding: '4px 10px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                +1 Week
              </button>
            </div>
          </div>

          {/* SECTION 1: STUDENT FACING DETAILS */}
          <div style={{ padding: '18px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: 'var(--accent-cyan)' }}>
              <FileText size={18} />
              <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>1. Student-Facing Materials & Instructions</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                  Assignment Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lab 2: Support Vector Machines & Kernels"
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                  Student Instructions & Problem Statement *
                </label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain the lab assignment objectives, problem statement, and expected deliverables to students..."
                  className="input-field"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                    Submission Deadline *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                    Maximum Marks *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(Number(e.target.value))}
                    className="input-field"
                  />
                </div>
              </div>

              {/* PDF Handout Attachment */}
              <div style={{ marginTop: '6px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                  Replace Attached Lab Handout / PDF (Optional)
                </label>
                <div style={{
                  border: '2px dashed var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '16px',
                  textAlign: 'center',
                  background: 'rgba(0, 0, 0, 0.2)',
                  cursor: 'pointer'
                }}>
                  <input
                    type="file"
                    id="edit-handout-upload"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(e) => setAttachment(e.target.files[0])}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="edit-handout-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <FileUp size={24} color="var(--accent-cyan)" />
                    {attachment ? (
                      <span style={{ fontSize: '0.88rem', color: 'var(--accent-green)', fontWeight: '600' }}>
                        Selected new file: {attachment.name} ({(attachment.size / 1024).toFixed(1)} KB)
                      </span>
                    ) : assignment.has_attachment ? (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Currently attached: <strong style={{ color: '#fff' }}>{assignment.attachment_name}</strong>. Click here to upload a replacement.
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Click to upload a PDF or document handout for students to download
                      </span>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: LLM PROMPT & GRADING RUBRIC */}
          <div style={{ padding: '18px', background: 'rgba(99, 102, 241, 0.04)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-purple)' }}>
                <Cpu size={18} />
                <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>2. AI Notebook File Checker — LLM Prompt & Rubric</span>
              </div>
              <span className="badge badge-purple" style={{ fontSize: '0.72rem' }}>
                Token-Efficient Text Only
              </span>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: '12px' }}>
              Provide the exact evaluation criteria and mark allocation. This textual rubric is passed directly into Gemini/Claude to score student notebooks.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                LLM Grading Rubric & Evaluation Prompt *
              </label>
              <textarea
                required
                rows={7}
                value={rubricText}
                onChange={(e) => setRubricText(e.target.value)}
                placeholder="List criteria, weights, edge cases, and expected outputs for each task..."
                className="input-field"
                style={{ fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.45', resize: 'vertical' }}
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
              style={{ background: 'linear-gradient(135deg, #f59e0b, #ec4899)', minWidth: '160px' }}
            >
              {saving ? 'Saving Changes...' : 'Save & Update Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
