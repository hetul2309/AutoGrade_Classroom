import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Shield, BookOpen, FileText, CheckCircle2, Clock, AlertTriangle,
  Search, RefreshCw, Trash2, ArrowRight, Layers, Mail, Calendar, UserCheck,
  IdCard, Filter, Eye, Sparkles, GraduationCap, School, Database
} from 'lucide-react';
import {
  getAdminStatsApi,
  getAdminUsersApi,
  deleteUserApi,
  getAdminAllClassesApi,
  getAdminAllSubmissionsApi
} from '../api';
import Toast from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AdminPortalPage({ currentUser, onSwitchToCourses }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'classes' | 'submissions'
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Search & Filter state for Users
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  // Search for Classes & Submissions
  const [classSearch, setClassSearch] = useState('');
  const [subSearch, setSubSearch] = useState('');

  // Delete modal state
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, usersData, classesData, subsData] = await Promise.all([
        getAdminStatsApi().catch(() => null),
        getAdminUsersApi(userSearch, userRoleFilter).catch(() => []),
        getAdminAllClassesApi().catch(() => []),
        getAdminAllSubmissionsApi().catch(() => []),
      ]);
      if (statsData) setStats(statsData);
      setUsers(usersData);
      setClasses(classesData);
      setSubmissions(subsData);
    } catch (err) {
      setToast({ message: err.message || 'Failed to load admin data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userRoleFilter]);

  // Handle live search for users
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      getAdminUsersApi(userSearch, userRoleFilter)
        .then((data) => setUsers(data))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(delayDebounceFn);
  }, [userSearch]);

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      setDeleting(true);
      await deleteUserApi(userToDelete.id);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setToast({ message: `User "${userToDelete.name}" was deleted successfully.`, type: 'success' });
      setUserToDelete(null);
      // Reload stats
      getAdminStatsApi().then(setStats).catch(() => {});
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete user', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const filteredClasses = useMemo(() => {
    if (!classSearch.trim()) return classes;
    const q = classSearch.toLowerCase();
    return classes.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.teacher_name.toLowerCase().includes(q)
    );
  }, [classes, classSearch]);

  const filteredSubmissions = useMemo(() => {
    if (!subSearch.trim()) return submissions;
    const q = subSearch.toLowerCase();
    return submissions.filter(
      (s) =>
        s.student_name.toLowerCase().includes(q) ||
        s.student_email.toLowerCase().includes(q) ||
        s.assignment_title.toLowerCase().includes(q) ||
        s.class_name.toLowerCase().includes(q)
    );
  }, [submissions, subSearch]);

  return (
    <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '32px 24px' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px',
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '28px', borderRadius: '16px', background: 'var(--modal-bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ef4444', marginBottom: '16px' }}>
              <AlertTriangle size={28} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0, color: 'var(--text-main)' }}>Delete User Account</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.5', marginBottom: '24px' }}>
              Are you sure you want to delete <strong>{userToDelete.name}</strong> ({userToDelete.email})? This will permanently remove their course enrollments and submissions.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="btn-secondary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="btn-danger"
                style={{ background: '#ef4444', color: '#ffffff', padding: '8px 18px', borderRadius: '8px', border: 'none', fontWeight: '600', cursor: 'pointer' }}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Portal Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px',
        marginBottom: '28px',
        padding: '24px 28px',
        borderRadius: '16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'var(--primary-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)'
          }}>
            <Database size={26} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.65rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
                Admin Database & Control Center
              </h1>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
              System-wide user database directory, enrolled accounts, classes monitor, and platform analytics.
            </p>
          </div>
        </div>

        {/* Switch to Classroom View Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={loadData}
            className="btn-ghost"
            style={{ padding: '9px 14px', fontSize: '0.88rem' }}
            title="Refresh database records"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={onSwitchToCourses}
            className="btn-primary"
            style={{ padding: '10px 18px', fontSize: '0.9rem', gap: '8px' }}
          >
            <BookOpen size={16} />
            <span>Open Classroom View</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Users
            </span>
            <Users size={20} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {stats?.total_users ?? users.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            {stats?.total_students ?? (users.filter(u => u.role !== 'admin').length)} Users • {stats?.total_admins ?? (users.filter(u => u.role === 'admin').length)} Admins
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Courses & Classes
            </span>
            <School size={20} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {stats?.total_classes ?? classes.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Active classrooms created
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Assignments
            </span>
            <FileText size={20} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {stats?.total_assignments ?? 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Jupyter notebook lab assignments
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Notebook Submissions
            </span>
            <CheckCircle2 size={20} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {stats?.total_submissions ?? submissions.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            {stats?.total_graded ?? 0} Evaluated & Graded
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '16px',
        marginBottom: '24px',
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('users')}
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
            background: activeTab === 'users' ? 'var(--primary-gradient)' : 'var(--bg-surface)',
            color: activeTab === 'users' ? '#ffffff' : 'var(--text-muted)',
            boxShadow: activeTab === 'users' ? 'var(--shadow-glow)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <Users size={18} />
          <span>User Database</span>
          <span style={{
            background: activeTab === 'users' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 106, 0, 0.1)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.78rem',
            fontWeight: '700',
          }}>
            {users.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('classes')}
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
            background: activeTab === 'classes' ? 'var(--primary-gradient)' : 'var(--bg-surface)',
            color: activeTab === 'classes' ? '#ffffff' : 'var(--text-muted)',
            boxShadow: activeTab === 'classes' ? 'var(--shadow-glow)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <School size={18} />
          <span>All Classes</span>
          <span style={{
            background: activeTab === 'classes' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 106, 0, 0.1)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.78rem',
            fontWeight: '700',
          }}>
            {classes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('submissions')}
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
            background: activeTab === 'submissions' ? 'var(--primary-gradient)' : 'var(--bg-surface)',
            color: activeTab === 'submissions' ? '#ffffff' : 'var(--text-muted)',
            boxShadow: activeTab === 'submissions' ? 'var(--shadow-glow)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <FileText size={18} />
          <span>Recent Submissions Log</span>
          <span style={{
            background: activeTab === 'submissions' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 106, 0, 0.1)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.78rem',
            fontWeight: '700',
          }}>
            {submissions.length}
          </span>
        </button>
      </div>

      {/* ── TAB 1: USERS DATABASE DIRECTORY ── */}
      {activeTab === 'users' && (
        <div>
          {/* Filters & Search Row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '320px', flex: 1 }}>
              <Search size={18} color="var(--text-dim)" style={{ position: 'absolute', left: '14px', top: '12px' }} />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by name, email, or Student ID / Roll No..."
                className="form-input"
                style={{ paddingLeft: '42px', fontSize: '0.9rem' }}
              />
            </div>

            {/* Role Filter Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-surface)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              {['all', 'user', 'admin'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setUserRoleFilter(r)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.84rem',
                    fontWeight: '600',
                    textTransform: 'capitalize',
                    background: userRoleFilter === r ? 'var(--primary-gradient)' : 'transparent',
                    color: userRoleFilter === r ? '#ffffff' : 'var(--text-muted)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {r === 'all' ? 'All Roles' : r === 'user' ? 'Users' : 'Admins'}
                </button>
              ))}
            </div>
          </div>

          {/* Users Table */}
          <div className="glass-panel" style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'var(--table-th-bg)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>User ID</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Full Name</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Email Address</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Student ID / Roll No</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Role</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Classes</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Registered Date</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '36px 0' }}>
                        <LoadingSpinner text="Loading database records..." size={48} minHeight="140px" />
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                        No user accounts matched your search criteria.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr
                        key={u.id}
                        style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', color: 'var(--primary)', fontWeight: '600' }}>
                          #{u.id}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: u.role === 'admin' ? 'linear-gradient(135deg, #ef4444, #f97316)' : 'var(--primary-gradient)',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.82rem',
                              fontWeight: '700',
                              flexShrink: 0
                            }}>
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{u.name}</div>
                              {(u.first_name || u.last_name) && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                                  {u.first_name} {u.last_name}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>
                          {u.email}
                        </td>
                        <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                          {u.student_id_str || u.id}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          {u.role === 'admin' ? (
                            <span className="badge badge-graded" style={{ padding: '3px 9px', fontSize: '0.75rem', fontWeight: '700' }}>
                              Admin
                            </span>
                          ) : (
                            <span className="badge" style={{ background: 'rgba(255, 106, 0, 0.12)', color: 'var(--primary)', border: '1px solid var(--border-subtle)', padding: '3px 9px', fontSize: '0.75rem', fontWeight: '700' }}>
                              User
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                          {u.teaching_classes_count > 0 && u.enrolled_classes_count > 0 ? (
                            <span>{u.teaching_classes_count} teaching • {u.enrolled_classes_count} enrolled</span>
                          ) : u.teaching_classes_count > 0 ? (
                            <span>{u.teaching_classes_count} teaching</span>
                          ) : u.enrolled_classes_count > 0 ? (
                            <span>{u.enrolled_classes_count} enrolled</span>
                          ) : (
                            <span style={{ color: 'var(--text-dim)' }}>0 classes</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 18px', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          {u.id !== currentUser?.id ? (
                            <button
                              type="button"
                              onClick={() => setUserToDelete(u)}
                              className="btn-ghost"
                              style={{ color: '#ef4444', padding: '6px 10px', borderRadius: '6px' }}
                              title="Delete user"
                            >
                              <Trash2 size={16} />
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Current Admin</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: ALL COURSES & CLASSES ── */}
      {activeTab === 'classes' && (
        <div>
          {/* Search Row */}
          <div style={{ marginBottom: '20px', maxWidth: '400px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} color="var(--text-dim)" style={{ position: 'absolute', left: '14px', top: '12px' }} />
              <input
                type="text"
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                placeholder="Search courses or instructors..."
                className="form-input"
                style={{ paddingLeft: '42px', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          <div className="glass-panel" style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'var(--table-th-bg)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Class ID</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Course Name</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Section</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Join Code</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Instructor</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Students</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Assignments</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Created Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClasses.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                        No courses found.
                      </td>
                    </tr>
                  ) : (
                    filteredClasses.map((c) => (
                      <tr
                        key={c.id}
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      >
                        <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                          #{c.id}
                        </td>
                        <td style={{ padding: '14px 18px', fontWeight: '700', color: 'var(--text-main)' }}>
                          {c.name}
                        </td>
                        <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>
                          {c.section || '—'}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{ background: 'rgba(255, 106, 0, 0.12)', border: '1px solid rgba(255, 106, 0, 0.3)', padding: '3px 8px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--primary)' }}>
                            {c.code}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{c.teacher_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{c.teacher_email}</div>
                        </td>
                        <td style={{ padding: '14px 18px', fontWeight: '700', color: '#10b981' }}>
                          {c.student_count} Students
                        </td>
                        <td style={{ padding: '14px 18px', fontWeight: '700', color: 'var(--primary)' }}>
                          {c.assignment_count} Assignments
                        </td>
                        <td style={{ padding: '14px 18px', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: RECENT SUBMISSIONS LOG ── */}
      {activeTab === 'submissions' && (
        <div>
          {/* Search Row */}
          <div style={{ marginBottom: '20px', maxWidth: '400px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} color="var(--text-dim)" style={{ position: 'absolute', left: '14px', top: '12px' }} />
              <input
                type="text"
                value={subSearch}
                onChange={(e) => setSubSearch(e.target.value)}
                placeholder="Search submissions by student or assignment..."
                className="form-input"
                style={{ paddingLeft: '42px', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          <div className="glass-panel" style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'var(--table-th-bg)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Sub ID</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Student</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Course & Assignment</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Notebook File</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Status</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Score</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700' }}>Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                        No notebook submissions recorded.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((s) => (
                      <tr
                        key={s.id}
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      >
                        <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                          #{s.id}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{s.student_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{s.student_email}</div>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{s.assignment_title}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{s.class_name}</div>
                        </td>
                        <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {s.file_name}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span className={`badge badge-${s.status}`} style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'capitalize' }}>
                            {s.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', fontWeight: '700' }}>
                          {s.marks !== null ? (
                            <span style={{ color: '#10b981' }}>{s.marks} / {s.max_marks}</span>
                          ) : (
                            <span style={{ color: 'var(--text-dim)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 18px', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                          {new Date(s.submitted_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
