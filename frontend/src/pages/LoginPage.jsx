import React, { useState, useEffect } from 'react';
import { BookOpen, Lock, Mail, ArrowRight, Shield, AlertCircle, User, IdCard, UserPlus, LogIn, CheckCircle2 } from 'lucide-react';
import { loginApi, registerApi, googleLoginApi } from '../api';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.4 7.34 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.92 0 12s.45 3.85 1.24 5.42l4.04-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.6 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

export default function LoginPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'

  // Login state
  const [loginEmail, setLoginEmail] = useState('admin@mlcourse.edu');
  const [loginPassword, setLoginPassword] = useState('admin123');

  // Sign up state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleGoogleCredentialResponse = async (response) => {
    if (!response || !response.credential) return;
    setLoading(true);
    setError(null);
    try {
      const data = await googleLoginApi(response.credential);
      onLoginSuccess(data);
    } catch (err) {
      setError(err.message || 'Google authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (window.google && clientId) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        const container = document.getElementById('google-signin-btn-container');
        if (container) {
          container.innerHTML = '';
          window.google.accounts.id.renderButton(container, {
            theme: 'filled_blue',
            size: 'large',
            width: 388,
            shape: 'rectangular',
            text: 'continue_with',
            logo_alignment: 'left',
          });
        }
      } catch (err) {
        console.warn('Google GSI Init failed:', err);
      }
    }
  }, [clientId, mode]);

  const handleManualGoogleClick = () => {
    if (window.google && clientId) {
      try {
        window.google.accounts.id.prompt();
      } catch {
        setError('Could not display Google One-Tap prompt.');
      }
    } else {
      setError('Google Sign-In is not configured yet. Please check VITE_GOOGLE_CLIENT_ID.');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await loginApi(loginEmail, loginPassword);
      onLoginSuccess(data);
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(null);

    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const data = await registerApi({
        first_name: firstName,
        last_name: lastName,
        email: signupEmail,
        student_id: studentId,
        password: signupPassword,
        confirm_password: confirmPassword,
      });
      onLoginSuccess(data);
    } catch (err) {
      setError(err.message || 'Registration failed. Please check your information.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (demoEmail, demoPass) => {
    setMode('login');
    setLoginEmail(demoEmail);
    setLoginPassword(demoPass);
    setError(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '36px', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '54px',
            height: '54px',
            margin: '0 auto 14px',
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
            AutoGrade <span style={{ color: 'var(--accent-cyan)' }}>Classroom</span>
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            AI-Powered Notebook Grading & Course Platform
          </p>
        </div>

        {/* Tab Switcher: Sign In vs Sign Up */}
        <div style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '4px',
          marginBottom: '24px',
          border: '1px solid var(--border-subtle)',
        }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: '9px',
              border: 'none',
              background: mode === 'login' ? 'var(--primary)' : 'transparent',
              color: mode === 'login' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: '600',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            <LogIn size={16} />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); }}
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: '9px',
              border: 'none',
              background: mode === 'signup' ? 'var(--primary)' : 'transparent',
              color: mode === 'signup' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: '600',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            <UserPlus size={16} />
            <span>Sign Up</span>
          </button>
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

        {/* Google SSO Button Container */}
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
          <div id="google-signin-btn-container" style={{ width: '100%', minHeight: '44px', display: 'flex', justifyContent: 'center' }}>
            {/* Fallback button if GSI script still loading */}
            <button
              type="button"
              onClick={handleManualGoogleClick}
              style={{
                width: '100%',
                padding: '11px 16px',
                background: 'rgba(255, 255, 255, 0.07)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                color: '#f3f4f6',
                fontSize: '0.92rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                transition: 'background 0.2s, border-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
        }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            or with email
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
        </div>


        {/* ── Mode: Sign In Form ── */}
        {mode === 'login' ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '7px' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="var(--text-dim)" style={{ position: 'absolute', left: '14px', top: '12px' }} />
                <input
                  id="login-email-input"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '42px' }}
                  placeholder="e.g. yourname@university.edu"
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '7px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="var(--text-dim)" style={{ position: 'absolute', left: '14px', top: '12px' }} />
                <input
                  id="login-password-input"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
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
              style={{ width: '100%', padding: '12px', marginTop: '4px', fontSize: '0.96rem' }}
              disabled={loading}
            >
              {loading ? (
                <span>Signing In...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        ) : (
          /* ── Mode: Sign Up Form ── */
          <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  First Name
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
                  <input
                    id="signup-first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '36px', fontSize: '0.88rem' }}
                    placeholder="Jane"
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Last Name
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
                  <input
                    id="signup-last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '36px', fontSize: '0.88rem' }}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
                <input
                  id="signup-email"
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '36px', fontSize: '0.88rem' }}
                  placeholder="jane.doe@university.edu"
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Student ID / Roll No
              </label>
              <div style={{ position: 'relative' }}>
                <IdCard size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
                <input
                  id="signup-student-id"
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '36px', fontSize: '0.88rem' }}
                  placeholder="e.g. 202401050 or STU-892"
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
                <input
                  id="signup-password"
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '36px', fontSize: '0.88rem' }}
                  placeholder="At least 6 characters"
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
                <input
                  id="signup-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '36px', fontSize: '0.88rem' }}
                  placeholder="Re-enter password"
                  required
                />
              </div>
            </div>

            <button
              id="signup-submit-btn"
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '6px', fontSize: '0.96rem' }}
              disabled={loading}
            >
              {loading ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Quick Demo Fill Buttons */}
        <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
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
              Fill Instructor (admin@mlcourse.edu)
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

