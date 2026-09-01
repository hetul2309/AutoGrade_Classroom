import React, { useState } from 'react';
import { BookOpen, Lock, Mail, ArrowRight, Shield, AlertCircle } from 'lucide-react';
import { loginApi } from '../api';

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('admin@mlcourse.edu');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await loginApi(email, password);
      onLoginSuccess(data);
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '36px', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '54px',
            height: '54px',
            margin: '0 auto 16px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 24px rgba(99, 102, 241, 0.5)'
          }}>
            <BookOpen size={28} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: '800', letterSpacing: '-0.03em' }}>
            AutoGrade <span style={{ color: 'var(--accent-cyan)' }}>ML</span>
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            Sign in to access the Teaching Assistant Dashboard
          </p>
        </div>

        {/* Error banner */}
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

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="var(--text-dim)" style={{ position: 'absolute', left: '14px', top: '12px' }} />
              <input
                id="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '42px' }}
                placeholder="admin@mlcourse.edu"
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="var(--text-dim)" style={{ position: 'absolute', left: '14px', top: '12px' }} />
              <input
                id="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '42px' }}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            className="btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: '6px', fontSize: '0.98rem' }}
            disabled={loading}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Fill Buttons */}
        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
            Quick Demo Accounts
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              onClick={() => fillCredentials('admin@mlcourse.edu', 'admin123')}
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.82rem', padding: '8px 12px' }}
            >
              <Shield size={14} color="var(--accent-cyan)" />
              Fill Admin TA (admin@mlcourse.edu)
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('alice@student.edu', 'student123')}
              className="btn-ghost"
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.82rem', padding: '6px 12px' }}
            >
              Fill Student (alice@student.edu)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
