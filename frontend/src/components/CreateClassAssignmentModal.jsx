import React, { useState } from 'react';
import { X, PlusCircle, Sparkles, FileUp, FileText, CheckCircle, ShieldAlert, Cpu } from 'lucide-react';
import { createClassAssignmentApi } from '../api';

export default function CreateClassAssignmentModal({ classId, onClose, onCreated }) {
  const getDefaultDeadline = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  };

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rubricText, setRubricText] = useState('');
  const [maxMarks, setMaxMarks] = useState(100);
  const [deadline, setDeadline] = useState(getDefaultDeadline());
  const [attachment, setAttachment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fillTemplate = () => {
    setTitle('Lab 3 — Convolutional Neural Networks & Image Classification');
    setDescription(
      'Implement a Convolutional Neural Network (CNN) architecture using PyTorch or TensorFlow. ' +
      'Train your model on the CIFAR-10 dataset to classify images into 10 categories. ' +
      'Your notebook must include data loading, model definition, training loop with loss curves, and evaluation.'
    );
    setRubricText(
      'Grading Breakdown (100 marks total):\n' +
      '1. CNN Architecture (30 marks):\n' +
      '   - Includes Conv2D layers, ReLU activations, and MaxPooling.\n' +
      '   - Properly flattened feature maps connected to linear classification head.\n' +
      '2. Training Loop & Optimization (30 marks):\n' +
      '   - Correct cross-entropy loss computation and backpropagation.\n' +
      '   - Optimizer updates weights each batch over multiple epochs.\n' +
      '3. Evaluation & Accuracy (20 marks):\n' +
      '   - Model achieves > 65% test accuracy.\n' +
      '   - Training and validation loss curves plotted with matplotlib.\n' +
      '4. Code Quality & Analysis (20 marks):\n' +
      '   - Clean code with docstrings, comments, and concise error analysis.'
    );
    setMaxMarks(100);
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
      formData.append('deadline', new Date(deadline).toISOString());
      if (attachment) {
        formData.append('attachment', attachment);
      }

      const created = await createClassAssignmentApi(classId, formData);
      onCreated(created);
    } catch (err) {
      setError(err.message || 'Failed to create assignment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlusCircle size={20} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Publish Class Assignment</h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                Upload student materials & configure token-efficient AI grading rubric
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

          {/* Quick template button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={fillTemplate}
              className="btn-ghost"
              style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Sparkles size={14} />
              <span>Auto-fill Sample Lab Template</span>
            </button>
          </div>

          {/* SECTION: STUDENT MATERIALS */}
          <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '12px', borderLeft: '4px solid #06b6d4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <FileText size={18} color="#06b6d4" />
              <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-bright)' }}>
                Student Materials & Lab Details
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>
                Visible to students in the classroom
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Assignment Title
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lab 1 — Linear Regression using Gradient Descent"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Student Task Description & Instructions
                </label>
                <textarea
                  rows={4}
                  className="form-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain the lab task, requirements, and deliverables for your students..."
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Attach Lab Handout / Reference PDF (Optional)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label
                    className="btn-secondary"
                    style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
                  >
                    <FileUp size={16} />
                    <span>{attachment ? 'Change Attached File' : 'Choose PDF / File'}</span>
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={(e) => setAttachment(e.target.files[0] || null)}
                    />
                  </label>
                  {attachment && (
                    <span style={{ fontSize: '0.84rem', color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle size={14} />
                      {attachment.name} ({(attachment.size / 1024).toFixed(0)} KB)
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  Students can download this handout from the classwork feed.
                </div>
              </div>
            </div>
          </div>

          {/* Max marks & Deadline */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Maximum Marks
              </label>
              <input
                type="number"
                step="1"
                min="1"
                className="form-input"
                value={maxMarks}
                onChange={(e) => setMaxMarks(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Submission Deadline
              </label>
              <input
                type="datetime-local"
                className="form-input"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              <PlusCircle size={16} />
              {saving ? 'Publishing...' : 'Publish to Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
