import React, { useState, useEffect } from 'react';
import {
  GraduationCap, Plus, UserPlus, Users, BookOpen, Copy, Check,
  Layers, ArrowRight, Sparkles, School, MoreVertical, Trash2, LogOut
} from 'lucide-react';
import {
  getClassesApi,
  unenrollFromClassApi,
  leaveClassTeacherApi,
  deleteClassApi
} from '../api';
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
  const [activeMenuClassId, setActiveMenuClassId] = useState(null);
  const [actionModal, setActionModal] = useState(null); // { type: 'delete' | 'leave' | 'unenroll', cls: Class }
  const [actionLoading, setActionLoading] = useState(false);

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

  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuClassId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleConfirmAction = async () => {
    if (!actionModal) return;
    const { type, cls } = actionModal;
    try {
      setActionLoading(true);
      if (type === 'delete') {
        const res = await deleteClassApi(cls.id);
        setToast({ message: res.message || `Class "${cls.name}" deleted.`, type: 'success' });
      } else if (type === 'leave') {
        const res = await leaveClassTeacherApi(cls.id);
        setToast({ message: res.message || `Left "${cls.name}".`, type: 'success' });
      } else if (type === 'unenroll') {
        const res = await unenrollFromClassApi(cls.id);
        setToast({ message: res.message || `Unenrolled from "${cls.name}".`, type: 'success' });
      }
      setActionModal(null);
      await loadClasses();
      window.dispatchEvent(new CustomEvent('classes-updated'));
    } catch (err) {
      setToast({ message: err.message || 'Action failed', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

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

      {/* Confirmation Modal for Delete / Leave / Unenroll */}
      {actionModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => !actionLoading && setActionModal(null)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '460px',
              width: '100%',
              padding: '28px',
              borderRadius: '20px',
              border: actionModal.type === 'delete' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: actionModal.type === 'delete' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: actionModal.type === 'delete' ? '#ef4444' : '#f59e0b',
                }}
              >
                {actionModal.type === 'delete' ? <Trash2 size={24} /> : <LogOut size={24} />}
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>
                  {actionModal.type === 'delete'
                    ? 'Delete Class?'
                    : actionModal.type === 'leave'
                    ? 'Leave Class?'
                    : 'Unenroll from Class?'}
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {actionModal.cls.name}
                </span>
              </div>
            </div>

            <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '24px' }}>
              {actionModal.type === 'delete' && (
                <>
                  Are you sure you want to permanently delete <strong>{actionModal.cls.name}</strong>?
                  This will permanently remove all assignments, student notebook submissions, grades, and enrollments.
                  <span style={{ display: 'block', marginTop: '8px', color: '#ef4444', fontWeight: '600' }}>
                    This action cannot be undone.
                  </span>
                </>
              )}
              {actionModal.type === 'leave' && (
                <>
                  Are you sure you want to leave <strong>{actionModal.cls.name}</strong> as a co-teacher?
                  You will no longer be able to create assignments, view student submissions, or grade notebooks for this class.
                </>
              )}
              {actionModal.type === 'unenroll' && (
                <>
                  Are you sure you want to unenroll from <strong>{actionModal.cls.name}</strong>?
                  You will be removed from the class roster. If you rejoin later, your past submissions and grades will still be preserved.
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setActionModal(null)}
                disabled={actionLoading}
                className="btn-secondary"
                style={{ padding: '10px 18px', borderRadius: '10px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={actionLoading}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  background: actionModal.type === 'delete' ? '#ef4444' : '#f59e0b',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: actionModal.type === 'delete' ? '0 4px 14px rgba(239, 68, 68, 0.4)' : '0 4px 14px rgba(245, 158, 11, 0.4)',
                }}
              >
                {actionLoading ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    {actionModal.type === 'delete' ? <Trash2 size={16} /> : <LogOut size={16} />}
                    <span>
                      {actionModal.type === 'delete'
                        ? 'Delete Class'
                        : actionModal.type === 'leave'
                        ? 'Leave Class'
                        : 'Unenroll'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ flex: 1, paddingRight: '6px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800', lineHeight: '1.3', margin: 0 }}>
                      {cls.name}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

                    {/* 3-Dots Action Menu */}
                    <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        title="Class Options"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuClassId((prev) => (prev === cls.id ? null : cls.id));
                        }}
                        style={{
                          background: 'rgba(0,0,0,0.3)',
                          backdropFilter: 'blur(8px)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '8px',
                          color: '#fff',
                          padding: '5px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.2s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.5)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.3)')}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {activeMenuClassId === cls.id && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '115%',
                            right: 0,
                            background: '#1e2029',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '12px',
                            boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
                            padding: '6px',
                            minWidth: '150px',
                            zIndex: 100,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {cls.is_creator || cls.teacher_id === user?.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuClassId(null);
                                setActionModal({ type: 'delete', cls });
                              }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: 'transparent',
                                color: '#ef4444',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                textAlign: 'left',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <Trash2 size={15} />
                              <span>Delete Class</span>
                            </button>
                          ) : cls.is_teacher ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuClassId(null);
                                setActionModal({ type: 'leave', cls });
                              }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: 'transparent',
                                color: '#f59e0b',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                textAlign: 'left',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <LogOut size={15} />
                              <span>Leave Class</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuClassId(null);
                                setActionModal({ type: 'unenroll', cls });
                              }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: 'transparent',
                                color: '#ef4444',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                textAlign: 'left',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <LogOut size={15} />
                              <span>Unenroll</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
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

