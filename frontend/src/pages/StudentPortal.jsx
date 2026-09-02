import React, { useState, useEffect, useMemo } from 'react';
import {
  Upload, FileText, CheckCircle2, Clock, AlertTriangle,
  Calendar, Award, BookOpen, AlertCircle, Sparkles, ChevronDown, ChevronUp, ArrowRight
} from 'lucide-react';
import { getAssignmentsApi, getMyGradesApi, uploadSubmissionApi } from '../api';
import Toast from '../components/Toast';

export default function StudentPortal({ currentUser }) {
  const [activeTab, setActiveTab] = useState('assignments'); // 'assignments' | 'grades'
  const [assignments, setAssignments] = useState([]);
  const [myGrades, setMyGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [expandedRubric, setExpandedRubric] = useState({});
  const [toast, setToast] = useState(null);

  // Load assignments and student's personal grades
  const loadData = async () => {
    setLoading(true);
    try {
      const [assignmentsList, gradesList] = await Promise.all([
        getAssignmentsApi(),
        getMyGradesApi(),
      ]);
      setAssignments(assignmentsList);
      setMyGrades(gradesList);
    } catch (err) {
      setToast({ message: err.message || 'Failed to load student data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map submissions/grades by assignment_id
  const gradeMapByAssignment = useMemo(() => {
    const map = {};
    for (const g of myGrades) {
      map[g.assignment_id] = g;
    }
    return map;
  }, [myGrades]);

  // Handle file selection
  const handleFileChange = (assignmentId, file) => {
    if (file && !file.name.endsWith('.ipynb')) {
      setToast({ message: 'Only Jupyter notebook (.ipynb) files are permitted.', type: 'error' });
      return;
    }
    setSelectedFiles((prev) => ({ ...prev, [assignmentId]: file }));
  };

  // Handle submit upload
  const handleUploadSubmit = async (assignmentId) => {
    const file = selectedFiles[assignmentId];
    if (!file) {
      setToast({ message: 'Please select a .ipynb notebook file to upload.', type: 'warning' });
      return;
    }

    setUploadingId(assignmentId);
    try {
      await uploadSubmissionApi(assignmentId, file);
      setToast({
        message: 'Notebook uploaded successfully! It is queued for evaluation after deadline.',
        type: 'success',
      });
      // Clear file selection and refresh
      setSelectedFiles((prev) => {
        const next = { ...prev };
        delete next[assignmentId];
        return next;
      });
      await loadData();
    } catch (err) {
      setToast({ message: err.message || 'Failed to upload submission', type: 'error' });
    } finally {
      setUploadingId(null);
    }
  };

  const toggleRubric = (id) => {
    setExpandedRubric((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Format date helper
  const formatDate = (isoStr) => {
    if (!isoStr) return 'N/A';
    const date = new Date(isoStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isDeadlinePassed = (deadlineStr) => {
    return new Date() > new Date(deadlineStr);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Hero Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span className="badge badge-graded" style={{ fontSize: '0.75rem' }}>
            Student Workspace
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
            Logged in as {currentUser?.name} ({currentUser?.email})
          </span>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.03em' }}>
          ML Lab Submissions & Feedback
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.94rem', marginTop: '6px' }}>
          Upload your Jupyter notebooks for evaluation. Feedback and grades are computed after the assignment deadline.
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '28px' }}>
        <button
          onClick={() => setActiveTab('assignments')}
          className="btn-ghost"
          style={{
            padding: '12px 20px',
            fontSize: '0.95rem',
            fontWeight: '600',
            color: activeTab === 'assignments' ? 'var(--text-main)' : 'var(--text-muted)',
            borderBottom: activeTab === 'assignments' ? '2px solid var(--primary)' : '2px solid transparent',
            borderRadius: '0',
          }}
        >
          <BookOpen size={16} />
          <span>Assignments & Uploads</span>
        </button>

        <button
          onClick={() => setActiveTab('grades')}
          className="btn-ghost"
          style={{
            padding: '12px 20px',
            fontSize: '0.95rem',
            fontWeight: '600',
            color: activeTab === 'grades' ? 'var(--text-main)' : 'var(--text-muted)',
            borderBottom: activeTab === 'grades' ? '2px solid var(--primary)' : '2px solid transparent',
            borderRadius: '0',
          }}
        >
          <Award size={16} />
          <span>My Grades & AI Feedback ({myGrades.filter(g => g.marks !== null).length})</span>
        </button>
      </div>

      {/* TAB 1: Assignments & Upload */}
      {activeTab === 'assignments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {assignments.length === 0 ? (
            <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-dim)' }}>
              No assignments available at this time.
            </div>
          ) : (
            assignments.map((assignment) => {
              const submission = gradeMapByAssignment[assignment.id];
              const pastDeadline = isDeadlinePassed(assignment.deadline);
              const selectedFile = selectedFiles[assignment.id];
              const isUploading = uploadingId === assignment.id;
              const hasRubricExpanded = expandedRubric[assignment.id];

              return (
                <div key={assignment.id} className="glass-panel" style={{ padding: '24px', borderLeft: pastDeadline ? '4px solid var(--border-subtle)' : '4px solid var(--primary)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: '700' }}>{assignment.title}</h2>
                        <span className="badge badge-pending" style={{ fontSize: '0.75rem' }}>
                          Max Marks: {assignment.max_marks}
                        </span>

                        {pastDeadline ? (
                          <span className="badge" style={{ background: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8', border: '1px solid rgba(100, 116, 139, 0.3)' }}>
                            Deadline Passed
                          </span>
                        ) : (
                          <span className="badge badge-graded">
                            <Clock size={10} /> Active Submission
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: '6px' }}>
                        <Calendar size={14} />
                        <span>Deadline: <strong style={{ color: pastDeadline ? '#f87171' : 'var(--text-muted)' }}>{formatDate(assignment.deadline)}</strong></span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div>
                      {submission ? (
                        <span className={`badge badge-${submission.status}`} style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
                          {submission.status === 'graded' && <CheckCircle2 size={12} />}
                          {submission.status === 'flagged' && <AlertTriangle size={12} />}
                          {submission.status === 'pending' && <Clock size={12} />}
                          {submission.status === 'graded' ? `Graded: ${submission.marks}/${submission.max_marks}` : `Status: ${submission.status}`}
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-dim)', border: '1px solid var(--border-subtle)' }}>
                          Not Submitted Yet
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Task Description */}
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.55', marginBottom: '16px' }}>
                    {assignment.description}
                  </p>

                  {/* Collapsible Rubric */}
                  <div style={{ marginBottom: '20px' }}>
                    <button
                      onClick={() => toggleRubric(assignment.id)}
                      className="btn-ghost"
                      style={{ padding: '4px 0', fontSize: '0.82rem', color: 'var(--accent-cyan)' }}
                    >
                      <span>{hasRubricExpanded ? 'Hide Grading Rubric' : 'View Grading Rubric & Breakdown'}</span>
                      {hasRubricExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {hasRubricExpanded && (
                      <div style={{
                        marginTop: '10px',
                        padding: '14px 18px',
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '10px',
                        fontSize: '0.84rem',
                        lineHeight: '1.6',
                        color: 'var(--text-muted)',
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        {assignment.rubric_text}
                      </div>
                    )}
                  </div>

                  {/* Submission Upload Area */}
                  <div style={{
                    padding: '18px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: 'rgba(99, 102, 241, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)'
                      }}>
                        <Upload size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                          {submission ? 'Update or Replace Submission' : 'Submit Lab Notebook'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                          Must be a Jupyter notebook file (<strong>.ipynb</strong>).
                        </div>
                      </div>
                    </div>

                    {pastDeadline ? (
                      <div style={{ fontSize: '0.85rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertCircle size={16} />
                        <span>Submissions are closed for this assignment.</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <label className="btn-secondary" style={{ cursor: 'pointer', padding: '8px 14px', fontSize: '0.85rem' }}>
                          <input
                            type="file"
                            accept=".ipynb"
                            onChange={(e) => handleFileChange(assignment.id, e.target.files[0])}
                            style={{ display: 'none' }}
                          />
                          <FileText size={14} />
                          <span>{selectedFile ? selectedFile.name : 'Choose .ipynb File'}</span>
                        </label>

                        {selectedFile && (
                          <button
                            onClick={() => handleUploadSubmit(assignment.id)}
                            disabled={isUploading}
                            className="btn-primary"
                            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                          >
                            {isUploading ? 'Uploading...' : 'Submit Notebook'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: My Grades & AI Feedback */}
      {activeTab === 'grades' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {myGrades.length === 0 ? (
            <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-dim)' }}>
              No submissions or grades recorded yet. Upload a notebook in the Assignments tab.
            </div>
          ) : (
            myGrades.map((gradeItem) => {
              const isGraded = gradeItem.marks !== null;
              const pct = isGraded && gradeItem.max_marks ? Math.round((gradeItem.marks / gradeItem.max_marks) * 100) : 0;
              const isFlagged = gradeItem.status === 'flagged';

              return (
                <div key={gradeItem.submission_id} className="glass-panel" style={{ padding: '24px' }}>
                  {/* Card Header */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>{gradeItem.assignment_title}</h3>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                        Submitted on: {formatDate(gradeItem.submitted_at)}
                      </div>
                    </div>

                    <span className={`badge badge-${gradeItem.status}`} style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
                      {gradeItem.status}
                    </span>
                  </div>

                  {/* Grade Score Display */}
                  {isGraded ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{
                        padding: '18px 22px',
                        background: 'rgba(255, 255, 255, 0.025)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '16px'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Your Score
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                            <span style={{ fontSize: '2.2rem', fontWeight: '800', color: isFlagged ? '#f87171' : '#34d399' }}>
                              {gradeItem.marks}
                            </span>
                            <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>/ {gradeItem.max_marks} marks</span>
                          </div>
                        </div>

                        <div style={{ minWidth: '180px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            <span>Percentage</span>
                            <strong style={{ color: 'var(--text-main)' }}>{pct}%</strong>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: isFlagged ? '#ef4444' : 'linear-gradient(90deg, #6366f1, #34d399)',
                              borderRadius: '999px',
                            }} />
                          </div>
                        </div>
                      </div>

                      {/* If Flagged Banner */}
                      {isFlagged && (
                        <div style={{
                          padding: '14px 18px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '10px',
                          color: '#f87171',
                          fontSize: '0.86rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px'
                        }}>
                          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                          <span>
                            <strong>Under Review:</strong> This submission was flagged by the automated code similarity analyzer and is currently scheduled for manual verification by the teaching team.
                          </span>
                        </div>
                      )}

                      {/* AI Reasoning & Detailed Feedback */}
                      {gradeItem.reasoning_text && (
                        <div style={{ padding: '18px 20px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '700', color: 'var(--accent-cyan)', marginBottom: '8px' }}>
                            <Sparkles size={16} />
                            <span>Evaluation Feedback & Rubric Reasoning</span>
                          </div>
                          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                            {gradeItem.reasoning_text}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Clock size={20} color="#60a5fa" />
                      <div style={{ fontSize: '0.88rem', color: '#93c5fd' }}>
                        Your submission has been received and is waiting for the post-deadline batch evaluation. Results will appear here automatically once graded.
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
