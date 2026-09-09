import React, { useState, useEffect } from 'react';
import {
  GraduationCap, Plus, UserPlus, Users, BookOpen, Copy, Check,
  Layers, ArrowRight, Sparkles, School
} from 'lucide-react';
import { getClassesApi } from '../api';
import CreateClassModal from '../components/CreateClassModal';
import JoinClassModal from '../components/JoinClassModal';
import Toast from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ClassroomPage({ user, onSelectClass }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('teaching'); // 'teaching' | 'enrolled'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [toast, setToast] = useState(null);

  const loadClasses = async () => {
    try {
      setLoading(true);
      const data = await getClassesApi();
      setClasses(data);
    } catch (err) {
      setToast({ message: err.message || 'Failed to load classes', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
    const handleRefresh = () => loadClasses();
    window.addEventListener('classes-updated', handleRefresh);
    return () => window.removeEventListener('classes-updated', handleRefresh);
  }, [user]);

  const handleCopyCode = (e, code) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setToast({ message: `Copied class code "${code}" to clipboard!`, type: 'success' });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleClassCreated = (newClass) => {
    const enrichedClass = {
      ...newClass,
      is_teacher: true,
      assignment_count: 0,
      student_count: 0,
      teacher_name: user?.name || 'You',
    };
    setClasses((prev) => [enrichedClass, ...prev]);
    setShowCreateModal(false);
    setActiveTab('teaching');
    setToast({ message: `Class "${newClass.name}" created! Code: ${newClass.code}`, type: 'success' });
  };

  const handleClassJoined = (joinedClass) => {
    const enrichedClass = {
      ...joinedClass,
      is_teacher: false,
    };
    setClasses((prev) => {
      const exists = prev.some((c) => c.id === joinedClass.id);
      return exists ? prev : [enrichedClass, ...prev];
    });
    setShowJoinModal(false);
    setActiveTab('enrolled');
    setToast({ message: `Successfully enrolled in "${joinedClass.name}"!`, type: 'success' });
  };

  // Separate teaching and enrolled classes
  const teachingClasses = classes.filter(
    (cls) => cls.is_teacher || cls.teacher_id === user?.id
  );
  const enrolledClasses = classes.filter(
    (cls) => !cls.is_teacher && cls.teacher_id !== user?.id
  );

  const displayClasses = activeTab === 'teaching' ? teachingClasses : enrolledClasses;

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {showCreateModal && (
        <CreateClassModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleClassCreated}
        />
      )}

      {showJoinModal && (
        <JoinClassModal
          onClose={() => setShowJoinModal(false)}
          onJoined={handleClassJoined}
        />
      )}

      {/* Dashboard Section Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em', marginBottom: '6px' }}>
            Course Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0 }}>
            Manage classes you instruct, or access enrolled courses and submit notebook assignments.
          </p>
        </div>

        {/* Action Buttons based on active tab / context */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {activeTab === 'teaching' ? (
            <button
              id="create-class-btn"
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
              style={{ padding: '10px 18px', fontSize: '0.9rem' }}
            >
              <Plus size={18} />
              <span>Create Class</span>
            </button>
          ) : (
            <button
              id="join-class-btn"
              onClick={() => setShowJoinModal(true)}
              className="btn-primary"
              style={{ padding: '10px 18px', fontSize: '0.9rem' }}
            >
              <UserPlus size={18} />
              <span>Join Class with Code</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs: Teaching vs Enrolled */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '16px',
        marginBottom: '28px',
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('teaching')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.95rem',
            background: activeTab === 'teaching' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
            color: activeTab === 'teaching' ? '#ffffff' : 'var(--text-muted)',
            boxShadow: activeTab === 'teaching' ? '0 4px 14px rgba(99, 102, 241, 0.35)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <GraduationCap size={18} />
          <span>Teaching</span>
          <span style={{
            background: activeTab === 'teaching' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.78rem',
            fontWeight: '700',
          }}>
            {teachingClasses.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('enrolled')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.95rem',
            background: activeTab === 'enrolled' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
            color: activeTab === 'enrolled' ? '#ffffff' : 'var(--text-muted)',
            boxShadow: activeTab === 'enrolled' ? '0 4px 14px rgba(99, 102, 241, 0.35)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <BookOpen size={18} />
          <span>Enrolled</span>
          <span style={{
            background: activeTab === 'enrolled' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.78rem',
            fontWeight: '700',
          }}>
            {enrolledClasses.length}
          </span>
        </button>
      </div>

      {/* Classes Grid */}
      {loading ? (
        <LoadingSpinner text="Loading classes..." size={56} minHeight="360px" />
      ) : displayClasses.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '64px 24px', borderRadius: '16px' }}>
          {activeTab === 'teaching' ? (
            <>
              <GraduationCap size={48} style={{ color: 'var(--text-dim)', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '8px' }}>No Teaching Classes Yet</h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto 20px', fontSize: '0.9rem' }}>
                You haven't created any courses as an instructor yet. Click "Create Class" to create your classroom, generate a join code, and post notebook assignments.
              </p>
              <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                <Plus size={16} />
                <span>Create a Class</span>
              </button>
            </>
          ) : (
            <>
              <BookOpen size={48} style={{ color: 'var(--text-dim)', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '8px' }}>No Enrolled Classes</h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto 20px', fontSize: '0.9rem' }}>
                You are not enrolled in any courses as a student yet. Click "Join Class with Code" and enter the 6-character code provided by your teacher.
              </p>
              <button onClick={() => setShowJoinModal(true)} className="btn-primary">
                <UserPlus size={16} />
                <span>Join a Class</span>
              </button>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {displayClasses.map((cls) => (
            <div
              key={cls.id}
              onClick={() => onSelectClass(cls.id)}
              className="glass-panel"
              style={{
                borderRadius: '16px',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid var(--border-subtle)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Classroom Header Banner */}
              <div
                style={{
                  background: cls.color || 'linear-gradient(135deg, #4f46e5, #06b6d4)',
                  padding: '24px 20px 18px',
                  color: '#fff',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, paddingRight: '12px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800', lineHeight: '1.3', margin: 0 }}>
                      {cls.name}
                    </h3>
                  </div>

                  {/* Class Code Pill with 1-click copy */}
                  <div
                    onClick={(e) => handleCopyCode(e, cls.code)}
                    title="Click to copy class code"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      backdropFilter: 'blur(8px)',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: '700',
                      letterSpacing: '1px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.2)',
                    }}
                  >
                    {copiedCode === cls.code ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    <span>{cls.code}</span>
                  </div>
                </div>

                <div style={{ marginTop: '16px', fontSize: '0.82rem', opacity: 0.95, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Instructor:</span>
                  <span style={{ fontWeight: '700' }}>
                    {cls.is_teacher || cls.teacher_id === user?.id ? `${cls.teacher_name} (You)` : cls.teacher_name}
                  </span>
                </div>
              </div>

              {/* Card Body & Stats */}
              <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <BookOpen size={16} color="var(--accent-cyan)" />
                    <span><strong>{cls.assignment_count}</strong> Assignments</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <Users size={16} color="var(--primary)" />
                    <span><strong>{cls.student_count}</strong> Students</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', color: 'var(--accent-cyan)', fontSize: '0.85rem', fontWeight: '600' }}>
                  <span>Open Class</span>
                  <ArrowRight size={16} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

