import React, { useState } from 'react';
import { X, PlusCircle, BookOpen, Palette } from 'lucide-react';
import { createClassApi } from '../api';

const COLOR_THEMES = [
  { name: 'Indigo Cyan', value: 'linear-gradient(135deg, #4f46e5, #06b6d4)' },
  { name: 'Purple Pink', value: 'linear-gradient(135deg, #7c3aed, #ec4899)' },
  { name: 'Emerald Teal', value: 'linear-gradient(135deg, #059669, #0d9488)' },
  { name: 'Amber Orange', value: 'linear-gradient(135deg, #d97706, #ea580c)' },
  { name: 'Rose Red', value: 'linear-gradient(135deg, #e11d48, #be123c)' },
  { name: 'Blue Slate', value: 'linear-gradient(135deg, #2563eb, #1e40af)' },
];

export default function CreateClassModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [color, setColor] = useState(COLOR_THEMES[0].value);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const created = await createClassApi({ name, section, color });
      onCreated(created);
    } catch (err) {
      setError(err.message || 'Failed to create class');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={20} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Create a New Class</h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                Set up a course space for students and assignments
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', color: '#f87171', fontSize: '0.88rem' }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Class Name (required)
            </label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CS401: Advanced Machine Learning"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Section / Semester
            </label>
            <input
              type="text"
              className="form-input"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="e.g. Section B - Fall 2026"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Theme Banner Color
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
              {COLOR_THEMES.map((theme) => (
                <button
                  key={theme.name}
                  type="button"
                  onClick={() => setColor(theme.value)}
                  style={{
                    height: '36px',
                    borderRadius: '8px',
                    background: theme.value,
                    border: color === theme.value ? '3px solid #fff' : '2px solid transparent',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'transform 0.15s ease',
                    transform: color === theme.value ? 'scale(1.08)' : 'scale(1)',
                  }}
                  title={theme.name}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              <PlusCircle size={16} />
              {loading ? 'Creating...' : 'Create Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
