import React, { useState } from 'react';
import { User, IdCard, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { updateProfileApi } from '../api';

export default function CompleteProfileModal({ isOpen, currentUser, onComplete }) {
  if (!isOpen) return null;

  const [firstName, setFirstName] = useState(currentUser?.first_name || currentUser?.name?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(currentUser?.last_name || currentUser?.name?.split(' ').slice(1).join(' ') || '');
  const [studentId, setStudentId] = useState(currentUser?.student_id_str || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) {
      setError('Please enter your Student ID number.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const updated = await updateProfileApi({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        student_id_str: studentId.trim(),
      });
      onComplete(updated);
    } catch (err) {
      setError(err.message || 'Failed to complete profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: '#131b2e',
        border: '1px solid var(--border-subtle)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 35px rgba(99, 102, 241, 0.25)',
        overflow: 'hidden',
        padding: '32px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.5)',
            marginBottom: '16px'
          }}>
            <Sparkles size={26} />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.4rem', fontWeight: '800', color: '#fff' }}>
            Complete Your Profile
          </h2>
          <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '0.88rem', lineHeight: 1.5 }}>
            Welcome to AutoGrade! Please confirm your student details to set up your account.
          </p>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '10px',
            color: '#f87171',
            fontSize: '0.88rem',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="form-input"
                placeholder="First name"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="form-input"
                placeholder="Last name"
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Student ID / Enrollment Number
            </label>
            <div style={{ position: 'relative' }}>
              <IdCard size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '14px', top: '12px' }} />
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '40px' }}
                placeholder="e.g. 202401045"
                required
                autoFocus
              />
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
              Used to identify your lab submissions and class grades.
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              padding: '12px 24px',
              fontSize: '0.95rem',
              fontWeight: '700',
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <CheckCircle2 size={18} />
            <span>{loading ? 'Saving Profile...' : 'Continue to Classroom'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
