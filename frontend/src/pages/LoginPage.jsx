import React, { useState, useEffect } from 'react';
import {
  BookOpen, Lock, Mail, ArrowRight, Shield, AlertCircle,
  User, IdCard, UserPlus, LogIn, CheckCircle2, Eye, EyeOff,
  KeyRound, RefreshCw, X, ArrowLeft, Sparkles, Sun, Moon
} from 'lucide-react';
import {
  loginApi,
  registerApi,
  googleLoginApi,
  sendOtpApi,
  verifyOtpApi,
  resetPasswordApi
} from '../api';
import Toast from '../components/Toast';
import lightLoadingSvg from '../assets/light_loading.svg';
import darkLoadingSvg from '../assets/dark_loading.svg';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
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

export default function LoginPage({ onLoginSuccess, theme = 'light', onToggleTheme }) {
  const isLight = theme === 'light';
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'signup-otp'

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign up state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signupOtp, setSignupOtp] = useState('');

  // Forgot Password State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = Enter Email, 2 = Enter OTP & New Password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'error') => {
    setToast({ message, type, id: Date.now() });
  };

  // Validation Helpers
  const validateName = (val, fieldLabel) => {
    if (!val || !val.trim()) {
      return `${fieldLabel} is required.`;
    }
    if (/^\s/.test(val)) {
      return `${fieldLabel} cannot start with a space.`;
    }
    if (/^\d/.test(val)) {
      return `${fieldLabel} cannot start with a number.`;
    }
    if (/[0-9]/.test(val)) {
      return `${fieldLabel} cannot contain numbers.`;
    }
    if (/[^a-zA-Z\s]/.test(val)) {
      return `${fieldLabel} cannot contain special characters.`;
    }
    if (val.length < 1 || val.length > 50) {
      return `${fieldLabel} must be between 1 and 50 characters.`;
    }
    return null;
  };

  const validateStudentId = (val) => {
    if (!val || !val.trim()) {
      return 'Student ID / Roll Number is required.';
    }
    const trimmed = val.trim();
    if (!/^\d+$/.test(trimmed)) {
      return 'Student ID / Roll Number must contain only numbers.';
    }
    if (trimmed.length < 1 || trimmed.length > 10) {
      return 'Student ID / Roll Number must be between 1 and 10 digits.';
    }
    return null;
  };

  const validatePassword = (pwd, fieldLabel = 'Password') => {
    if (!pwd) {
      return `${fieldLabel} is required.`;
    }
    if (pwd.length < 8 || pwd.length > 16) {
      return `${fieldLabel} must be between 8 and 16 characters.`;
    }
    if (!/[A-Z]/.test(pwd)) {
      return `${fieldLabel} must contain at least 1 uppercase letter (A-Z).`;
    }
    if (!/[a-z]/.test(pwd)) {
      return `${fieldLabel} must contain at least 1 lowercase letter (a-z).`;
    }
    if (!/[0-9]/.test(pwd)) {
      return `${fieldLabel} must contain at least 1 number (0-9).`;
    }
    if (!/[^A-Za-z0-9]/.test(pwd)) {
      return `${fieldLabel} must contain at least 1 special character.`;
    }
    return null;
  };

  const validateEmail = (val) => {
    if (!val || !val.trim()) {
      return 'Email address is required.';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val.trim())) {
      return 'Please enter a valid email address.';
    }
    return null;
  };

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleGoogleCredentialResponse = async (response) => {
    if (!response || !response.credential) return;
    setLoading(true);
    setError(null);
    try {
      const data = await googleLoginApi(response.credential);
      onLoginSuccess(data);
    } catch (err) {
      showToast(err.message || 'Google authentication failed. Please try again.', 'error');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (window.google && clientId && (mode === 'login' || mode === 'signup')) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
        });

        const gsiOverlay = document.getElementById('google-gsi-hidden-overlay');
        if (gsiOverlay) {
          window.google.accounts.id.renderButton(gsiOverlay, {
            theme: isLight ? 'outline' : 'filled_black',
            size: 'large',
            width: 400,
            shape: 'rectangular',
          });
        }
      } catch (err) {
        console.warn('Google GSI Init failed:', err);
      }
    }
  }, [clientId, mode, isLight]);

  const handleManualGoogleClick = () => {
    if (window.google && clientId) {
      try {
        window.google.accounts.id.prompt();
      } catch {
        showToast('Could not display Google One-Tap prompt.', 'error');
      }
    } else {
      showToast('Google Sign-In is not configured yet. Please check VITE_GOOGLE_CLIENT_ID.', 'warning');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const emailErr = validateEmail(loginEmail);
    if (emailErr) {
      showToast(emailErr, 'error');
      return;
    }
    if (!loginPassword) {
      showToast('Please enter your password.', 'error');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await loginApi(loginEmail.trim().toLowerCase(), loginPassword);
      onLoginSuccess(data);
    } catch (err) {
      showToast(err.message || 'Incorrect email or password.', 'error');
      setLoading(false);
    }
  };

  // Step 1: Initiate Sign-up by sending OTP to email
  const handleInitiateSignUp = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const fnErr = validateName(firstName, 'First name');
    if (fnErr) {
      showToast(fnErr, 'error');
      return;
    }

    const lnErr = validateName(lastName, 'Last name');
    if (lnErr) {
      showToast(lnErr, 'error');
      return;
    }

    const emailErr = validateEmail(signupEmail);
    if (emailErr) {
      showToast(emailErr, 'error');
      return;
    }

    const sidErr = validateStudentId(studentId);
    if (sidErr) {
      showToast(sidErr, 'error');
      return;
    }

    const pwdErr = validatePassword(signupPassword, 'Password');
    if (pwdErr) {
      showToast(pwdErr, 'error');
      return;
    }

    if (signupPassword !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    setLoading(true);
    try {
      await sendOtpApi(signupEmail.trim(), 'signup');
      setMode('signup-otp');
      setSuccessMsg(`Verification code sent to ${signupEmail.trim()}. Please enter the 6-digit code.`);
    } catch (err) {
      showToast(err.message || 'Failed to send verification code. Please check your email.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and finalize registration
  const handleVerifySignupOtp = async (e) => {
    e.preventDefault();
    if (!signupOtp.trim() || signupOtp.trim().length !== 6) {
      showToast('Please enter the 6-digit verification code.', 'error');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await verifyOtpApi(signupEmail.trim(), signupOtp.trim(), 'signup');
      const registerData = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: signupEmail.trim().toLowerCase(),
        student_id: studentId.trim(),
        password: signupPassword,
        confirm_password: confirmPassword,
      };
      const data = await registerApi(registerData);
      onLoginSuccess(data);
    } catch (err) {
      showToast(err.message || 'Verification failed. Please enter the correct code.', 'error');
      setLoading(false);
    }
  };

  // Resend Sign-Up OTP
  const handleResendSignupOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      await sendOtpApi(signupEmail.trim(), 'signup');
      setSuccessMsg(`New code dispatched to ${signupEmail.trim()}.`);
      showToast(`New code dispatched to ${signupEmail.trim()}.`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to resend verification code.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password: Step 1 Send OTP
  const handleForgotSendOtp = async (e) => {
    e.preventDefault();
    const emailErr = validateEmail(forgotEmail);
    if (emailErr) {
      showToast(emailErr, 'error');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await sendOtpApi(forgotEmail.trim(), 'forgot_password');
      setForgotStep(2);
      setSuccessMsg(`Reset code sent to ${forgotEmail.trim()}.`);
    } catch (err) {
      showToast(err.message || 'No registered account found with this email.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password: Step 2 Reset Password with OTP
  const handleForgotResetPassword = async (e) => {
    e.preventDefault();
    if (!forgotOtp.trim() || forgotOtp.trim().length !== 6) {
      showToast('Please enter the 6-digit verification code.', 'error');
      return;
    }
    const pwdErr = validatePassword(forgotNewPassword, 'New password');
    if (pwdErr) {
      showToast(pwdErr, 'error');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await resetPasswordApi(forgotEmail.trim(), forgotOtp.trim(), forgotNewPassword, forgotConfirmPassword);
      setShowForgotPassword(false);
      setForgotStep(1);
      setForgotOtp('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
      setLoginEmail(forgotEmail.trim());
      setSuccessMsg(res.message || 'Password reset successfully! Please sign in with your new password.');
      showToast(res.message || 'Password reset successfully! Please sign in with your new password.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to reset password. Please check your verification code.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Centered Loading Overlay with Foreground SVG and Subtle Backdrop Blur */}
      {loading && (
        <div
          id="auth-loading-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.48)' : 'rgba(9, 13, 22, 0.58)',
            pointerEvents: 'all',
            cursor: 'wait',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '28px 36px',
              borderRadius: '22px',
              background: isLight ? 'rgba(255, 255, 255, 0.88)' : 'rgba(15, 23, 42, 0.88)',
              border: isLight ? '1px solid rgba(255, 106, 0, 0.2)' : '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: isLight
                ? '0 16px 40px -10px rgba(255, 106, 0, 0.22), 0 0 24px rgba(255, 106, 0, 0.12)'
                : '0 16px 40px -10px rgba(0, 0, 0, 0.7), 0 0 24px rgba(99, 102, 241, 0.15)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <img
              src={isLight ? lightLoadingSvg : darkLoadingSvg}
              alt="Loading..."
              style={{
                width: '72px',
                height: '72px',
                display: 'block',
                userSelect: 'none',
              }}
            />
            <span
              style={{
                fontSize: '0.94rem',
                fontWeight: '600',
                color: isLight ? '#1e293b' : '#f8fafc',
                marginTop: '14px',
                letterSpacing: '0.01em',
              }}
            >
              {mode === 'login'
                ? 'Signing in, please wait...'
                : mode === 'signup'
                ? 'Sending verification code...'
                : mode === 'signup-otp'
                ? 'Verifying account...'
                : 'Processing, please wait...'}
            </span>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          key={toast.id || toast.message}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {/* Top right Theme Toggle */}
      {onToggleTheme && (
        <div style={{ position: 'absolute', top: '24px', right: '24px', zIndex: 10 }}>
          <button
            type="button"
            onClick={onToggleTheme}
            title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
            aria-label="Toggle Theme"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isLight ? '#FF6A00' : '#f8fafc',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-card)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.transform = 'rotate(15deg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.transform = 'rotate(0deg)';
            }}
          >
            {isLight ? <Sun size={18} color="#FF6A00" /> : <Moon size={18} color="#a5b4fc" />}
          </button>
        </div>
      )}

      {/* Background glowing orbs */}
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: isLight
          ? 'radial-gradient(circle, rgba(255, 106, 0, 0.12) 0%, rgba(0, 0, 0, 0) 70%)'
          : 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
        top: '-100px',
        left: '-100px',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: isLight
          ? 'radial-gradient(circle, rgba(255, 45, 141, 0.1) 0%, rgba(0, 0, 0, 0) 70%)'
          : 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
        bottom: '-100px',
        right: '-100px',
        pointerEvents: 'none',
      }} />

      {/* Main card */}
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: mode === 'signup' ? '480px' : '440px',
        padding: '36px',
        position: 'relative',
        zIndex: 1,
        borderRadius: '24px',
        boxShadow: 'var(--shadow-card)',
        transition: 'max-width 0.3s ease'
      }}>
        {/* Logo / Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'var(--primary-gradient)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)',
            marginBottom: '16px',
          }}>
            <BookOpen size={28} color="#ffffff" />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.65rem',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            margin: '0 0 6px',
            color: 'var(--text-main)'
          }}>
            AutoGrade <span style={{ color: isLight ? '#FF2D8D' : 'var(--accent-cyan)' }}>Classroom</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            {mode === 'signup-otp'
              ? 'Email Verification'
              : mode === 'login'
              ? 'Sign in to access your classes and grades'
              : 'Create your classroom account'}
          </p>
        </div>

        {/* Tab switcher (Login vs Signup) */}
        {mode !== 'signup-otp' && (
          <div style={{
            display: 'flex',
            background: isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(0, 0, 0, 0.28)',
            borderRadius: '12px',
            padding: '4px',
            marginBottom: '22px',
            border: isLight ? '1px solid #e2e8f0' : '1px solid var(--border-subtle)',
          }}>
            <button
              type="button"
              id="tab-login"
              onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }}
              style={{
                flex: 1,
                padding: '9px',
                borderRadius: '9px',
                border: 'none',
                background: mode === 'login' ? 'var(--primary)' : 'transparent',
                color: mode === 'login' ? '#ffffff' : (isLight ? '#64748b' : 'var(--text-dim)'),
                fontWeight: '600',
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: mode === 'login' && isLight ? '0 4px 12px rgba(255, 106, 0, 0.25)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <LogIn size={16} />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              id="tab-signup"
              onClick={() => { setMode('signup'); setError(null); setSuccessMsg(null); }}
              style={{
                flex: 1,
                padding: '9px',
                borderRadius: '9px',
                border: 'none',
                background: mode === 'signup' ? 'var(--primary)' : 'transparent',
                color: mode === 'signup' ? '#ffffff' : (isLight ? '#64748b' : 'var(--text-dim)'),
                fontWeight: '600',
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: mode === 'signup' && isLight ? '0 4px 12px rgba(255, 106, 0, 0.25)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <UserPlus size={16} />
              <span>Sign Up</span>
            </button>
          </div>
        )}

        {/* Status Banners */}
        {successMsg && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '10px',
            color: '#34d399',
            fontSize: '0.88rem',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Google SSO Container (Only in Login/Signup modes) */}
        {mode !== 'signup-otp' && (
          <div style={{ marginBottom: '22px' }}>
            <div
              style={{
                position: 'relative',
                width: '100%',
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              {/* Visual Custom Google Button */}
              <button
                type="button"
                id="google-custom-signin-btn"
                className="google-auth-btn"
                onClick={handleManualGoogleClick}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = isLight ? '#FF6A00' : 'rgba(255, 106, 0, 0.7)';
                  e.currentTarget.style.background = isLight
                    ? 'linear-gradient(135deg, #ffffff 0%, #fff7f2 100%)'
                    : 'rgba(255, 255, 255, 0.09)';
                  e.currentTarget.style.color = isLight ? '#FF6A00' : '#FFA066';
                  e.currentTarget.style.boxShadow = isLight
                    ? '0 8px 24px -4px rgba(255, 106, 0, 0.22), 0 2px 6px rgba(255, 106, 0, 0.1)'
                    : '0 8px 24px -4px rgba(255, 106, 0, 0.3)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.12)';
                  e.currentTarget.style.background = isLight
                    ? 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)'
                    : 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = isLight ? '#1e293b' : '#f8fafc';
                  e.currentTarget.style.boxShadow = isLight
                    ? '0 2px 8px -2px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.03)'
                    : '0 4px 14px -4px rgba(0, 0, 0, 0.35)';
                  e.currentTarget.style.transform = 'translateY(0px)';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translateY(0px) scale(0.99)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
              >
                <GoogleIcon />
                <span>
                  {mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
                </span>
              </button>

              {/* Hidden GSI overlay to capture clicks seamlessly for Google Identity Services */}
              <div
                id="google-gsi-hidden-overlay"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0.001,
                  zIndex: 3,
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
              />
            </div>

            {/* Dashed divider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                marginTop: '20px',
                marginBottom: '6px',
              }}
            >
              <span
                style={{
                  flex: 1,
                  borderTop: isLight ? '1px dashed #cbd5e1' : '1px dashed rgba(255, 255, 255, 0.12)',
                }}
              />
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.35em',
                  color: isLight ? '#94a3b8' : 'rgba(148, 163, 184, 0.75)',
                }}
              >
                or
              </span>
              <span
                style={{
                  flex: 1,
                  borderTop: isLight ? '1px dashed #cbd5e1' : '1px dashed rgba(255, 255, 255, 0.12)',
                }}
              />
            </div>
          </div>
        )}

        {/* ── MODE: SIGN IN ── */}
        {mode === 'login' && (
          <form noValidate onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                  placeholder="Enter your email address"
                  required
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(true); setError(null); setSuccessMsg(null); setForgotEmail(loginEmail); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-cyan)',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Forgot password?
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <Lock size={18} color="var(--text-dim)" style={{ position: 'absolute', left: '14px', top: '12px' }} />
                <input
                  id="login-password-input"
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '42px', paddingRight: '42px' }}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)'
                  }}
                >
                  {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              className="btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '6px',
                fontSize: '0.96rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <img
                    src={isLight ? lightLoadingSvg : darkLoadingSvg}
                    alt=""
                    style={{ width: '20px', height: '20px', display: 'inline-block' }}
                  />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* ── MODE: SIGN UP (Step 1) ── */}
        {mode === 'signup' && (
          <form noValidate onSubmit={handleInitiateSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                    maxLength={50}
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
                    maxLength={50}
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
                  maxLength={10}
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '36px', fontSize: '0.88rem' }}
                  placeholder="e.g. 202401050 (numbers only)"
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
                  type={showSignupPassword ? 'text' : 'password'}
                  maxLength={16}
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '36px', paddingRight: '36px', fontSize: '0.88rem' }}
                  placeholder="8-16 chars (Aa1@)"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)'
                  }}
                >
                  {showSignupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
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
                  type={showConfirmPassword ? 'text' : 'password'}
                  maxLength={16}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '36px', paddingRight: '36px', fontSize: '0.88rem' }}
                  placeholder="Confirm password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)'
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              id="signup-submit-btn"
              type="submit"
              className="btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '6px',
                fontSize: '0.94rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <img
                    src={isLight ? lightLoadingSvg : darkLoadingSvg}
                    alt=""
                    style={{ width: '20px', height: '20px', display: 'inline-block' }}
                  />
                  <span>Sending Verification Code...</span>
                </>
              ) : (
                <>
                  <span>Verify Email & Sign Up</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* ── MODE: SIGN UP OTP VERIFICATION (Step 2) ── */}
        {mode === 'signup-otp' && (
          <form noValidate onSubmit={handleVerifySignupOtp} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Enter the 6-digit code sent to:
              </p>
              <div style={{ fontWeight: '700', color: '#fff', fontSize: '1rem', marginTop: '4px' }}>
                {signupEmail}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textAlign: 'center' }}>
                6-Digit Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={signupOtp}
                onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, ''))}
                className="form-input"
                style={{
                  textAlign: 'center',
                  fontSize: '1.6rem',
                  letterSpacing: '8px',
                  fontWeight: '800',
                  fontFamily: 'monospace'
                }}
                placeholder="••••••"
                autoFocus
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleResendSignupOtp}
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={14} />
                <span>Resend Code</span>
              </button>
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '0.96rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
              disabled={loading || signupOtp.length < 6}
            >
              {loading ? (
                <>
                  <img
                    src={isLight ? lightLoadingSvg : darkLoadingSvg}
                    alt=""
                    style={{ width: '20px', height: '20px', display: 'inline-block' }}
                  />
                  <span>Verifying Account...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>Verify & Create Account</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); setSuccessMsg(null); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-dim)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <ArrowLeft size={14} />
              <span>Back to Sign Up</span>
            </button>
          </form>
        )}
      </div>

      {/* ── FORGOT PASSWORD MODAL ── */}
      {showForgotPassword && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          animation: 'fadeIn 0.15s ease-out'
        }}>
          <div style={{
            background: 'var(--modal-bg, #131b2e)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '440px',
            boxShadow: 'var(--shadow-card)',
            overflow: 'hidden',
            padding: '28px'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(255, 106, 0, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)'
                }}>
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>Reset Password</h3>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                    {forgotStep === 1 ? 'Step 1: Request verification code' : 'Step 2: Set new password'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setShowForgotPassword(false); setError(null); setSuccessMsg(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Error / Success inside modal */}
            {error && (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '0.84rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '8px',
                color: '#34d399',
                fontSize: '0.84rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Step 1: Enter Email */}
            {forgotStep === 1 ? (
              <form noValidate onSubmit={handleForgotSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Enter your registered email address. We will send a 6-digit code to verify your identity.
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="form-input"
                      style={{ paddingLeft: '38px' }}
                      placeholder="Enter registered email"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ width: '100%', padding: '11px', fontSize: '0.92rem', marginTop: '6px' }}
                >
                  {loading ? 'Sending Code...' : 'Send Verification Code'}
                </button>
              </form>
            ) : (
              /* Step 2: Enter OTP & New Password */
              <form noValidate onSubmit={handleForgotResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                    className="form-input"
                    style={{ textAlign: 'center', fontSize: '1.3rem', letterSpacing: '6px', fontWeight: '800', fontFamily: 'monospace' }}
                    placeholder="••••••"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
                    <input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      maxLength={16}
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      className="form-input"
                      style={{ paddingLeft: '38px', paddingRight: '38px', fontSize: '0.88rem' }}
                      placeholder="8-16 chars (Aa1@)"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      style={{
                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)'
                      }}
                    >
                      {showForgotNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Confirm New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
                    <input
                      type={showForgotConfirmPassword ? 'text' : 'password'}
                      maxLength={16}
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      className="form-input"
                      style={{ paddingLeft: '38px', paddingRight: '38px', fontSize: '0.88rem' }}
                      placeholder="Confirm new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                      style={{
                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)'
                      }}
                    >
                      {showForgotConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ width: '100%', padding: '11px', fontSize: '0.92rem', marginTop: '6px' }}
                >
                  {loading ? 'Resetting Password...' : 'Reset Password'}
                </button>

                <button
                  type="button"
                  onClick={() => { setForgotStep(1); setError(null); }}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-dim)',
                    fontSize: '0.82rem', cursor: 'pointer', textAlign: 'center'
                  }}
                >
                  ← Back to Email step
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
