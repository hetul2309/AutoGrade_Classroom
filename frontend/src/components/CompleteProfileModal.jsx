import React, { useState } from 'react';
import { User, IdCard, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { updateProfileApi } from '../api';
import Toast from './Toast';

export default function CompleteProfileModal({ isOpen, currentUser, onComplete }) {
  if (!isOpen) return null;

  // Helper: do not pre-fill names if they start with a number (e.g. student email 202401045@...)
  const sanitizeInitialName = (val) => {
    if (!val) return '';
    const clean = String(val).trim();
    return /^\d/.test(clean) ? '' : clean;
  };

  const getInitialStudentId = () => {
    if (currentUser?.student_id_str && currentUser.student_id_str !== 'ADMIN') {
      return currentUser.student_id_str;
    }
    const emailPrefix = currentUser?.email ? currentUser.email.split('@')[0] : '';
    if (/^\d+$/.test(emailPrefix)) {
      return emailPrefix;
    }
    const rawName = currentUser?.name || currentUser?.first_name || '';
    const digitsMatch = String(rawName).match(/^\d+/);
    if (digitsMatch) {
      return digitsMatch[0];
    }
    return '';
  };

  const rawFirst = currentUser?.first_name || currentUser?.name?.split(' ')[0] || '';
  const rawLast = currentUser?.last_name || currentUser?.name?.split(' ').slice(1).join(' ') || '';

  const [firstName, setFirstName] = useState(sanitizeInitialName(rawFirst));
  const [lastName, setLastName] = useState(sanitizeInitialName(rawLast));
  const [studentId, setStudentId] = useState(getInitialStudentId());
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'error') => {
    setToast({ message, type, id: Date.now() });
  };

  const handleFirstNameChange = (e) => {
    const val = e.target.value;
    if (val && /^\d/.test(val)) {
      showToast('First name cannot start with a number.', 'error');
    }
    setFirstName(val);
  };

  const handleLastNameChange = (e) => {
    const val = e.target.value;
    if (val && /^\d/.test(val)) {
      showToast('Last name cannot start with a number.', 'error');
    }
    setLastName(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanSid = studentId.trim();

    if (!cleanFirst) {
      showToast('Please enter your first name.', 'error');
      return;
    }

    if (/^\d/.test(cleanFirst)) {
      showToast('First name cannot start with a number. Please enter a valid name.', 'error');
      return;
    }

    if (!cleanLast) {
      showToast('Please enter your last name.', 'error');
      return;
    }

    if (/^\d/.test(cleanLast)) {
      showToast('Last name cannot start with a number. Please enter a valid name.', 'error');
      return;
    }

    if (!cleanSid) {
      showToast('Please enter your Student ID / Roll number.', 'error');
      return;
    }

    setLoading(true);
    try {
      const updated = await updateProfileApi({
        first_name: cleanFirst,
        last_name: cleanLast,
        student_id_str: cleanSid,
      });
      onComplete(updated);
    } catch (err) {
      showToast(err.message || 'Failed to complete profile. Please try again.', 'error');
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
        background: 'var(--modal-bg, #131b2e)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
        padding: '32px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            background: 'var(--primary-gradient)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: 'var(--shadow-glow)',
            marginBottom: '16px'
          }}>
            <Sparkles size={26} />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)' }}>
            Complete Your Profile
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
            Welcome to AutoGrade! Please confirm your student details to set up your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={handleFirstNameChange}
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
                onChange={handleLastNameChange}
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
                placeholder="e.g. 123456789"
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

      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
