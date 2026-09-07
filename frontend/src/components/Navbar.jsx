import React, { useState, useRef, useEffect } from 'react';
import {
  BookOpen, LogOut, Shield, User, ChevronDown, KeyRound, Settings,
  Sparkles, CheckCircle2, UserCheck, Sun, Moon, Bell
} from 'lucide-react';
import NotificationBell from './Notifications/NotificationBell';

export default function Navbar({
  currentUser,
  currentView,
  theme = 'light',
  onToggleTheme,
  onNavigateView,
  onOpenProfile,
  onRequestLogout
}) {
  const isAdmin = currentUser?.role === 'admin';
  const isLight = theme === 'light';
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [dropdownOpen]);

  return (
    <header className="glass-panel" style={{ borderRadius: '0', borderLeft: 'none', borderRight: 'none', borderTop: 'none', position: 'sticky', top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Brand */}
        <div
          onClick={() => onNavigateView(isAdmin ? 'admin-portal' : 'classroom')}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
          title={isAdmin ? "Go to Admin Portal" : "Go to My Classes"}
        >
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'var(--primary-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)'
          }}>
            <BookOpen size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: '700', letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
                AutoGrade <span style={{ color: isLight ? '#FF2D8D' : 'var(--accent-cyan)' }}>Classroom</span>
              </span>
              <span className={`badge ${isAdmin ? 'badge-graded' : 'badge-pending'}`} style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                <Shield size={10} /> {isAdmin ? 'Admin' : 'User'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              AI Automated Notebook Grading & Classroom Platform
            </div>
          </div>
        </div>

        {/* User Info & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isAdmin && (
            <button
              id="nav-admin-portal-btn"
              onClick={() => onNavigateView('admin-portal')}
              style={{
                fontSize: '0.84rem',
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: '600',
                background: currentView === 'admin-portal' ? 'var(--primary-gradient)' : 'rgba(255, 106, 0, 0.08)',
                color: currentView === 'admin-portal' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              <Shield size={14} />
              <span>Admin Portal</span>
            </button>
          )}

          <button
            id="nav-my-classes-btn"
            onClick={() => onNavigateView('classroom')}
            style={{
              fontSize: '0.84rem',
              padding: '7px 14px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: '600',
              background: currentView === 'classroom' ? 'var(--primary-gradient)' : 'rgba(255, 106, 0, 0.08)',
              color: currentView === 'classroom' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            <BookOpen size={14} />
            <span>My Classes</span>
          </button>

          {/* Theme Switcher Button */}
          <button
            id="nav-theme-toggle-btn"
            type="button"
            onClick={onToggleTheme}
            title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
            aria-label="Toggle Theme"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: isLight ? 'rgba(255, 106, 0, 0.12)' : 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isLight ? '#FF6A00' : '#f8fafc',
              cursor: 'pointer',
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

          {/* Notification Bell Popup */}
          <NotificationBell currentUser={currentUser} />

          {/* Interactive Profile Dropdown Button */}
          {currentUser && (
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <button
                id="profile-dropdown-btn"
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '5px 12px 5px 6px',
                  background: dropdownOpen ? 'rgba(255, 106, 0, 0.15)' : 'var(--bg-card)',
                  borderRadius: '999px',
                  border: dropdownOpen ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Avatar */}
                {currentUser.avatar_url ? (
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser.name}
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '1.5px solid var(--primary)'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: 'var(--primary-gradient)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: '0.85rem'
                  }}>
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : <User size={15} />}
                  </div>
                )}

                <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)' }}>{currentUser.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{currentUser.email}</div>
                </div>

                <ChevronDown
                  size={14}
                  color="var(--text-dim)"
                  style={{
                    transform: dropdownOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s ease'
                  }}
                />
              </button>

              {/* Dropdown Floating Menu */}
              {dropdownOpen && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  width: '260px',
                  background: 'var(--dropdown-bg, #131b2e)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '16px',
                  boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.4), 0 0 25px rgba(255, 106, 0, 0.15)',
                  padding: '8px',
                  zIndex: 50,
                  animation: 'fadeIn 0.15s ease-out'
                }}>
                  {/* User Profile Card Header */}
                  <div style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    marginBottom: '6px'
                  }}>
                    <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-main)' }}>{currentUser.name}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', wordBreak: 'break-all', marginTop: '2px' }}>
                      {currentUser.email}
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <span className={`badge ${isAdmin ? 'badge-graded' : 'badge-pending'}`} style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                        <Shield size={10} /> {isAdmin ? 'Admin' : 'User'}
                        {currentUser.student_id_str && currentUser.student_id_str !== 'ADMIN' && ` • ID: ${currentUser.student_id_str}`}
                      </span>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen(false); onOpenProfile(); }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s, color 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 106, 0, 0.1)';
                      e.currentTarget.style.color = 'var(--text-main)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                  >
                    <User size={16} color="var(--primary)" />
                    <span>View Profile</span>
                  </button>

                  <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '6px 0' }} />

                  <button
                    id="menu-logout-btn"
                    type="button"
                    onClick={() => { setDropdownOpen(false); onRequestLogout(); }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none';
                    }}
                  >
                    <LogOut size={16} color="#ef4444" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

