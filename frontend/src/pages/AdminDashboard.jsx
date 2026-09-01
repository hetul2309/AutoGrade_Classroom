import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles, Play, RefreshCw, Search, Filter, AlertTriangle,
  CheckCircle2, Clock, Edit3, Eye, FileText, ChevronDown, ChevronUp, Layers
} from 'lucide-react';
import {
  getAssignmentsApi,
  getAdminAssignmentGradesApi,
  triggerGradingApi
} from '../api';
import EditGradeModal from '../components/EditGradeModal';
import SimilarityFlagModal from '../components/SimilarityFlagModal';
import Toast from '../components/Toast';

export default function AdminDashboard() {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [directMode, setDirectMode] = useState(true); // default direct for immediate feedback
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals & toast state
  const [editingGrade, setEditingGrade] = useState(null);
  const [inspectingFlag, setInspectingFlag] = useState(null);
  const [expandedReasoning, setExpandedReasoning] = useState({});
  const [toast, setToast] = useState(null);

  // 1. Fetch Assignments
  useEffect(() => {
    async function loadAssignments() {
      try {
        const list = await getAssignmentsApi();
        setAssignments(list);
        if (list.length > 0) {
          setSelectedAssignmentId(list[0].id);
        }
      } catch (err) {
        setToast({ message: err.message || 'Failed to load assignments', type: 'error' });
      } finally {
        setLoading(false);
      }
    }
    loadAssignments();
  }, []);

  // 2. Fetch Grades when selected assignment changes
  const loadGrades = async (assignmentId) => {
    if (!assignmentId) return;
    setLoading(true);
    try {
      const data = await getAdminAssignmentGradesApi(assignmentId);
      setGrades(data);
    } catch (err) {
      setToast({ message: err.message || 'Failed to load student grades', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAssignmentId) {
      loadGrades(selectedAssignmentId);
    }
  }, [selectedAssignmentId]);

  // Current active assignment object
  const currentAssignment = useMemo(() => {
    return assignments.find((a) => a.id === Number(selectedAssignmentId)) || null;
  }, [assignments, selectedAssignmentId]);

  // 3. Trigger Grading Pipeline
  const handleTriggerGrading = async () => {
    if (!selectedAssignmentId) return;
    setTriggering(true);
    try {
      const res = await triggerGradingApi(selectedAssignmentId, directMode);
      setToast({
        message: res.message || 'Grading pipeline initiated successfully!',
        type: res.status === 'failed' ? 'error' : 'success',
      });
      // Refresh grades after grading finishes
      await loadGrades(selectedAssignmentId);
    } catch (err) {
      setToast({ message: err.message || 'Error triggering grading pipeline', type: 'error' });
    } finally {
      setTriggering(false);
    }
  };

  // 4. Handle Save from Edit Grade Modal
  const handleGradeSaved = (updatedItem) => {
    setGrades((prev) =>
      prev.map((item) => (item.grade_id === updatedItem.grade_id ? updatedItem : item))
    );
    setEditingGrade(null);
    setToast({ message: `Successfully updated grade for ${updatedItem.student_name}!`, type: 'success' });
  };

  // Toggle expandable reasoning text
  const toggleReasoning = (submissionId) => {
    setExpandedReasoning((prev) => ({
      ...prev,
      [submissionId]: !prev[submissionId],
    }));
  };

  // Filtered grades list
  const filteredGrades = useMemo(() => {
    return grades.filter((g) => {
      const matchesSearch =
        g.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.student_email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'flagged'
          ? g.flagged
          : g.submission_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [grades, searchQuery, statusFilter]);

  // Key Statistics
  const stats = useMemo(() => {
    const total = grades.length;
    const graded = grades.filter((g) => g.marks !== null).length;
    const flagged = grades.filter((g) => g.flagged).length;
    const pending = grades.filter((g) => g.submission_status === 'pending').length;

    let avgMarks = 0;
    if (graded > 0) {
      const sum = grades.reduce((acc, g) => acc + (g.marks || 0), 0);
      avgMarks = (sum / graded).toFixed(1);
    }

    return { total, graded, flagged, pending, avgMarks };
  }, [grades]);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Toast notifications */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Edit & Flag modals */}
      {editingGrade && (
        <EditGradeModal
          gradeItem={editingGrade}
          onClose={() => setEditingGrade(null)}
          onSaveSuccess={handleGradeSaved}
        />
      )}

      {inspectingFlag && (
        <SimilarityFlagModal
          gradeItem={inspectingFlag}
          onClose={() => setInspectingFlag(null)}
        />
      )}

      {/* Top Header: Assignment Selector + Trigger Action */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Lab Assignments Overview</h1>
            <span className="badge badge-pending" style={{ textTransform: 'none', fontSize: '0.8rem' }}>
              PostgreSQL Live
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Inspect student notebook submissions, evaluate plagiarism similarity flags, and manage grades.
          </p>
        </div>

        {/* Assignment Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select
            id="assignment-select"
            value={selectedAssignmentId || ''}
            onChange={(e) => setSelectedAssignmentId(e.target.value)}
            className="form-input"
            style={{ minWidth: '260px', fontWeight: '600' }}
          >
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({a.max_marks} marks)
              </option>
            ))}
          </select>

          <button
            onClick={() => loadGrades(selectedAssignmentId)}
            className="btn-secondary"
            title="Refresh submissions"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Active Assignment Info Banner */}
      {currentAssignment && (
        <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '28px', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ maxWidth: '750px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>{currentAssignment.title}</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                  Max Marks: {currentAssignment.max_marks}
                </span>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                {currentAssignment.description}
              </p>
            </div>

            {/* Trigger Grading Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={directMode}
                    onChange={(e) => setDirectMode(e.target.checked)}
                    style={{ accentColor: '#6366f1' }}
                  />
                  <span>Direct Execution (Instant)</span>
                </label>

                <button
                  id="trigger-grading-btn"
                  onClick={handleTriggerGrading}
                  disabled={triggering || stats.pending === 0}
                  className="btn-primary"
                  style={{
                    background: stats.pending > 0
                      ? 'linear-gradient(135deg, #10b981, #059669)'
                      : undefined
                  }}
                >
                  {triggering ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Grading in Progress...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Trigger Grading ({stats.pending} pending)</span>
                    </>
                  )}
                </button>
              </div>

              <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                {directMode ? 'Executes immediate LangGraph pass' : 'Submits to Anthropic Message Batches API'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="glass-panel" style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Submissions
            </span>
            <Layers size={18} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', marginTop: '8px' }}>{stats.total}</div>
        </div>

        <div className="glass-panel" style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Graded Submissions
            </span>
            <CheckCircle2 size={18} color="#34d399" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', marginTop: '8px', color: '#34d399' }}>
            {stats.graded} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)', fontWeight: '500' }}>/ {stats.total}</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px 22px', borderLeft: stats.flagged > 0 ? '3px solid #ef4444' : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: stats.flagged > 0 ? '#f87171' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: stats.flagged > 0 ? '700' : '500' }}>
              Flagged Plagiarism
            </span>
            <AlertTriangle size={18} color={stats.flagged > 0 ? '#f87171' : 'var(--text-dim)'} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', marginTop: '8px', color: stats.flagged > 0 ? '#f87171' : 'var(--text-main)' }}>
            {stats.flagged}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Class Average
            </span>
            <Sparkles size={18} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', marginTop: '8px', color: 'var(--accent-cyan)' }}>
            {stats.avgMarks} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>pts</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ position: 'relative', minWidth: '280px', flexGrow: 1, maxWidth: '420px' }}>
          <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '14px', top: '12px' }} />
          <input
            id="search-students-input"
            type="text"
            placeholder="Search by student name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '40px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Filter size={16} color="var(--text-dim)" />
          <select
            id="status-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-input"
            style={{ width: '170px' }}
          >
            <option value="all">All Statuses ({grades.length})</option>
            <option value="flagged">Flagged ({stats.flagged})</option>
            <option value="graded">Graded ({stats.graded})</option>
            <option value="pending">Pending ({stats.pending})</option>
          </select>
        </div>
      </div>

      {/* Grades Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>Marks</th>
                <th style={{ width: '360px' }}>AI Reasoning & Feedback</th>
                <th>Plagiarism</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredGrades.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-dim)' }}>
                    No student submissions found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredGrades.map((item) => {
                  const isFlagged = item.flagged;
                  const isExpanded = expandedReasoning[item.submission_id];
                  const hasGrade = item.marks !== null;

                  return (
                    <tr key={item.submission_id} className={isFlagged ? 'row-flagged' : ''}>
                      {/* Student Info */}
                      <td>
                        <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{item.student_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{item.student_email}</div>
                      </td>

                      {/* Status Badge */}
                      <td>
                        <span className={`badge badge-${item.submission_status}`}>
                          {item.submission_status === 'flagged' && <AlertTriangle size={10} />}
                          {item.submission_status === 'graded' && <CheckCircle2 size={10} />}
                          {item.submission_status === 'pending' && <Clock size={10} />}
                          {item.submission_status}
                        </span>
                      </td>

                      {/* Marks */}
                      <td>
                        {hasGrade ? (
                          <div>
                            <span style={{ fontSize: '1.1rem', fontWeight: '700', color: isFlagged ? '#f87171' : '#34d399' }}>
                              {item.marks}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}> / {item.max_marks}</span>
                            {item.manually_edited && (
                              <div style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: '500' }}>
                                (Edited by TA)
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Not graded</span>
                        )}
                      </td>

                      {/* AI Reasoning (Expandable) */}
                      <td>
                        {item.reasoning_text ? (
                          <div>
                            <div style={{
                              fontSize: '0.84rem',
                              lineHeight: '1.45',
                              color: 'var(--text-muted)',
                              maxHeight: isExpanded ? 'none' : '44px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {item.reasoning_text}
                            </div>
                            {item.reasoning_text.length > 80 && (
                              <button
                                onClick={() => toggleReasoning(item.submission_id)}
                                className="btn-ghost"
                                style={{ padding: '2px 0', marginTop: '4px', fontSize: '0.75rem', color: 'var(--primary)' }}
                              >
                                {isExpanded ? (
                                  <>Show less <ChevronUp size={12} /></>
                                ) : (
                                  <>Show more <ChevronDown size={12} /></>
                                )}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Awaiting pipeline run</span>
                        )}
                      </td>

                      {/* Plagiarism Badge / Inspector */}
                      <td>
                        {isFlagged ? (
                          <button
                            onClick={() => setInspectingFlag(item)}
                            className="badge badge-flagged"
                            style={{ cursor: 'pointer', border: '1px solid #ef4444' }}
                            title="Inspect similarity report"
                          >
                            <AlertTriangle size={12} />
                            <span>100% Match</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Clean</span>
                        )}
                      </td>

                      {/* Actions: Edit & Inspect */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          {hasGrade && (
                            <button
                              id={`edit-grade-btn-${item.submission_id}`}
                              onClick={() => setEditingGrade(item)}
                              className="btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            >
                              <Edit3 size={13} />
                              <span>Edit</span>
                            </button>
                          )}
                          {isFlagged && (
                            <button
                              onClick={() => setInspectingFlag(item)}
                              className="btn-ghost"
                              style={{ padding: '6px 10px', fontSize: '0.8rem', color: '#f87171' }}
                            >
                              <Eye size={13} />
                              <span>Details</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
