import React, { useState } from 'react';
import { X, PlusCircle, Sparkles, Calendar, BookOpen, Layers } from 'lucide-react';
import { createAssignmentApi } from '../api';

export default function CreateAssignmentModal({ onClose, onCreated }) {
  const getDefaultDeadline = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  };

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rubricText, setRubricText] = useState('');
  const [maxMarks, setMaxMarks] = useState(100);
  const [deadline, setDeadline] = useState(getDefaultDeadline());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fillTemplate = () => {
    setTitle('Lab 3 — Deep Learning & Convolutional Neural Networks');
    setDescription(
      'Implement a Convolutional Neural Network (CNN) from scratch using PyTorch or NumPy. ' +
      'Train the model on the CIFAR-10 dataset to classify images into 10 categories. ' +
      'Plot training vs validation loss curves and compute the final test set accuracy.'
    );
    setRubricText(
      'Grading Breakdown (100 marks total):\n' +
      '1. CNN Architecture Implementation (30 marks):\n' +
      '   - Includes Conv2D layers, ReLU activations, and MaxPooling.\n' +
      '   - Properly flattened output connected to linear classification head.\n' +
      '2. Training Loop & Optimization (30 marks):\n' +
      '   - Correct cross-entropy loss computation and backpropagation.\n' +
      '   - Optimizer updates weights each batch over multiple epochs.\n' +
      '3. Model Evaluation & Accuracy (20 marks):\n' +
      '   - Model achieves > 65% accuracy on test set.\n' +
      '   - Learning loss curve plotted clearly with matplotlib.\n' +
      '4. Code Quality & Analysis (20 marks):\n' +
      '   - Clean, modular code structure with docstrings.\n' +
      '   - Brief discussion analyzing misclassified examples.'
    );
    setMaxMarks(100);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        title,
        description,
        rubric_text: rubricText,
        max_marks: parseFloat(maxMarks),
        deadline: new Date(deadline).toISOString(),
      };
      const created = await createAssignmentApi(payload);
      onCreated(created);
    } catch (err) {
      setError(err.message || 'Failed to create assignment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlusCircle size={20} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Create New Lab Assignment</h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                Provide task requirements and detailed rubric for automated AI grading
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', color: '#f87171', fontSize: '0.88rem' }}>
              {error}
            </div>
          )}

          {/* Quick template fill */}
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

          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Assignment Title
            </label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lab 3 — Convolutional Neural Networks"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Task Instructions & Student Objectives
            </label>
            <textarea
              rows={3}
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the problem statement and student deliverables..."
              required
            />
          </div>

          {/* Rubric Breakdown */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                Grading Rubric & Marks Allocation
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                The AI evaluates code against these specific criteria
              </span>
            </div>
            <textarea
              rows={6}
              className="form-input"
              value={rubricText}
              onChange={(e) => setRubricText(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem', lineHeight: '1.5' }}
              placeholder="1. Architecture implementation (30 marks)&#10;2. Training loop & convergence (30 marks)&#10;3. Accuracy & plots (20 marks)&#10;4. Comments & code clarity (20 marks)"
              required
            />
          </div>

          {/* Max marks & Deadline */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
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
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
              Cancel
            </button>
            <button id="create-assignment-submit-btn" type="submit" className="btn-primary" disabled={saving}>
              <PlusCircle size={16} />
              {saving ? 'Creating Assignment...' : 'Publish Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
