import React from 'react';
import { BookOpen, LogOut, Shield, User, Sparkles } from 'lucide-react';
import { clearAuthSession } from '../api';

export default function Navbar({ currentUser, onNavigateHome, onLogout }) {
  const isAdmin = currentUser?.role === 'admin';

  return (
    <header className="glass-panel" style={{ borderRadius: '0', borderLeft: 'none', borderRight: 'none', borderTop: 'none', position: 'sticky', top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Brand */}
        <div
          onClick={onNavigateHome}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
          title="Back to All Classes"
        >
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(99, 102, 241, 0.4)'
          }}>
            <BookOpen size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: '700', letterSpacing: '-0.02em' }}>
                AutoGrade <span style={{ color: 'var(--accent-cyan)' }}>Classroom</span>
              </span>
              <span className={`badge ${isAdmin ? 'badge-processing' : 'badge-graded'}`} style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                <Shield size={10} /> {isAdmin ? 'Teacher / TA' : 'Student'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Multi-Class Automated Grading & Plagiarism Platform
            </div>
          </div>
        </div>

        {/* User Info & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onNavigateHome}
            className="btn-ghost"
            style={{ fontSize: '0.82rem', padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <BookOpen size={15} />
            <span>My Classes</span>
          </button>

          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '999px', border: '1px solid var(--border-subtle)' }}>
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}>
                <User size={14} />
              </div>
              <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: '600' }}>{currentUser.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{currentUser.email}</div>
              </div>
            </div>
          )}

          <button
            id="logout-btn"
            onClick={onLogout}
            className="btn-ghost"
            style={{ color: '#f87171' }}
            title="Log Out"
          >
            <LogOut size={16} />
            <span style={{ fontSize: '0.85rem' }}>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
