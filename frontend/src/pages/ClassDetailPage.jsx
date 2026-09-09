import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft, BookOpen, Users, Cpu, Plus, Copy, Check, FileDown,
  Upload, Clock, CheckCircle2, AlertTriangle, Play, Sparkles,
  ChevronDown, ChevronUp, Edit3, Eye, FileText, Calendar, RefreshCw,
  RotateCw, RotateCcw, Save, X, HelpCircle, Send, EyeOff,
  School, GraduationCap, Shield, UserPlus, Trash2
} from 'lucide-react';
import {
  getClassDetailsApi,
  getClassAssignmentsApi,
  getClassStudentsApi,
  getClassPeopleApi,
  inviteClassTeacherApi,
  removeClassTeacherApi,
  removeClassStudentApi,
  getAdminAssignmentGradesApi,
  triggerGradingApi,
  recheckAllAssignmentApi,
  recheckSubmissionApi,
  publishAssignmentResultsApi,
  unpublishAssignmentResultsApi,
  downloadSingleSubmissionApi,
  downloadAllSubmissionsZipApi,
  updateAssignmentApi,
  uploadSubmissionApi,
  getMyGradesApi,
  getAssignmentAttachmentUrl
} from '../api';
import CreateClassAssignmentModal from '../components/CreateClassAssignmentModal';
import EditAssignmentModal from '../components/EditAssignmentModal';
import EditGradeModal from '../components/EditGradeModal';
import SimilarityFlagModal from '../components/SimilarityFlagModal';
import Toast from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';

import lavenderLoadingSvg from '../assets/lavender_loading.svg';
import pinkLoadingSvg from '../assets/pink_loading.svg';
import orangeRecheckSvg from '../assets/orange_recheck_loading.svg';
import blueRecheckSvg from '../assets/blue_recheck_loading.svg';
import lightRecheckAllSvg from '../assets/light_recheck_all_loading.svg';
import darkRecheckAllSvg from '../assets/dark_recheck_all_loading.svg';

export default function ClassDetailPage({ classId, user, onBack, theme = 'light' }) {
  const isLight = theme === 'light';
  const [classData, setClassData] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState(null); // { type: 'student' | 'teacher', member }
  const [removing, setRemoving] = useState(false);
  const [activeTab, setActiveTab] = useState('classwork'); // 'classwork' | 'evaluation' | 'people'
  const [loading, setLoading] = useState(true);

  // Student upload & grade states
  const [studentGrades, setStudentGrades] = useState([]);
  const [uploadingAssignmentId, setUploadingAssignmentId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);

  // Admin evaluation tab states
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  const [evalGrades, setEvalGrades] = useState([]);
  const [evalLoading, setEvalLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [directMode, setDirectMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Prompt, Rubric & Plagiarism policy states
  const [editingPromptRubric, setEditingPromptRubric] = useState(false);
  const [promptLlmDesc, setPromptLlmDesc] = useState('');
  const [promptRubric, setPromptRubric] = useState('');
  const [promptPlagiarism, setPromptPlagiarism] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);

  // Recheck single & all states
  const [recheckingSubId, setRecheckingSubId] = useState(null);
  const [confirmRecheckSub, setConfirmRecheckSub] = useState(null);
  const [confirmRecheckAll, setConfirmRecheckAll] = useState(false);
  const [recheckingAll, setRecheckingAll] = useState(false);
  const [quotaError, setQuotaError] = useState(null);

  // Refs for tracking active recheck state in async intervals
  const recheckingSubIdRef = useRef(recheckingSubId);
  const recheckingAllRef = useRef(recheckingAll);
  const triggeringRef = useRef(triggering);

  useEffect(() => {
    recheckingSubIdRef.current = recheckingSubId;
    recheckingAllRef.current = recheckingAll;
    triggeringRef.current = triggering;
  }, [recheckingSubId, recheckingAll, triggering]);

  // Publish Results state
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishingResults, setPublishingResults] = useState(false);

  // Notebook download states
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadingSubId, setDownloadingSubId] = useState(null);

  // Modals & UI toggles
  const [showCreateAssignmentModal, setShowCreateAssignmentModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editingGrade, setEditingGrade] = useState(null);
  const [inspectingFlag, setInspectingFlag] = useState(null);
  const [expandedRubric, setExpandedRubric] = useState({});
  const [expandedReasoning, setExpandedReasoning] = useState({});
  const [copiedCode, setCopiedCode] = useState(false);
  const [toast, setToast] = useState(null);

  const isOwner = Boolean(classData ? (classData.teacher_id === user?.id) : false);
  const isTeacher = Boolean(classData ? (isOwner || classData.is_teacher || user?.role === 'admin' || teachers.some(t => t.id === user?.id)) : user?.role === 'admin');

  // 1. Load initial class data
  const loadClassInfo = async () => {
    try {
      setLoading(true);
      const [cData, aList, peopleData] = await Promise.all([
        getClassDetailsApi(classId),
        getClassAssignmentsApi(classId),
        getClassPeopleApi(classId),
      ]);
      setClassData(cData);
      setAssignments(aList);
      setTeachers(peopleData?.teachers || []);
      setStudents(peopleData?.students || []);
      if (aList.length > 0) {
        setSelectedAssignmentId(aList[0].id);
      }
    } catch (err) {
      setToast({ message: err.message || 'Failed to load class info', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const reloadPeople = async () => {
    try {
      setPeopleLoading(true);
      const peopleData = await getClassPeopleApi(classId);
      setTeachers(peopleData?.teachers || []);
      setStudents(peopleData?.students || []);
    } catch (err) {
      console.warn('Failed to refresh people list:', err);
    } finally {
      setPeopleLoading(false);
    }
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      setInviting(true);
      await inviteClassTeacherApi(classId, inviteEmail.trim());
      setToast({
        message: `Invitation successfully sent to ${inviteEmail}! They will see it in their notifications.`,
        type: 'success',
      });
      setShowInviteModal(false);
      setInviteEmail('');
      reloadPeople();
    } catch (err) {
      setToast({ message: err.message || 'Failed to send invitation', type: 'error' });
    } finally {
      setInviting(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!confirmRemoveMember) return;
    const { type, member } = confirmRemoveMember;
    try {
      setRemoving(true);
      if (type === 'teacher') {
        await removeClassTeacherApi(classId, member.id);
        setToast({ message: `Removed ${member.name} as co-teacher.`, type: 'success' });
      } else {
        await removeClassStudentApi(classId, member.id || member.student_id);
        setToast({ message: `Removed ${member.name} from class.`, type: 'success' });
      }
      setConfirmRemoveMember(null);
      reloadPeople();
    } catch (err) {
      setToast({ message: err.message || 'Failed to remove member', type: 'error' });
    } finally {
      setRemoving(false);
    }
  };

  useEffect(() => {
    if (classId) {
      loadClassInfo();
    }
  }, [classId]);

  // 2. Load student grades for this class (student view)
  const loadStudentGrades = async () => {
    if (isTeacher) return;
    try {
      const grades = await getMyGradesApi();
      setStudentGrades(grades);
    } catch (err) {
      console.error('Failed to load student grades:', err);
    }
  };

  useEffect(() => {
    loadStudentGrades();
    if (!isTeacher) {
      const interval = setInterval(loadStudentGrades, 5000);
      return () => clearInterval(interval);
    }
  }, [isTeacher, assignments]);

  // 3. Load admin evaluation grades when selected assignment changes
  const loadEvalGrades = async (assignmentId, silent = false) => {
    if (!assignmentId || !isTeacher) return;
    try {
      if (!silent) setEvalLoading(true);
      const data = await getAdminAssignmentGradesApi(assignmentId);
      setEvalGrades(data);
    } catch (err) {
      if (!silent) {
        setToast({ message: err.message || 'Failed to load grades', type: 'error' });
      }
    } finally {
      if (!silent) setEvalLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'evaluation' && selectedAssignmentId && isTeacher) {
      loadEvalGrades(selectedAssignmentId);
      // Auto-poll silently every 5s so teacher sees live student uploads in real-time (strictly paused during active operations)
      const interval = setInterval(() => {
        if (!recheckingAllRef.current && !recheckingSubIdRef.current && !triggeringRef.current) {
          loadEvalGrades(selectedAssignmentId, true);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, selectedAssignmentId, isTeacher]);

  // Auto-sync when window / browser tab regains focus
  useEffect(() => {
    const handleFocus = () => {
      if (isTeacher && activeTab === 'evaluation' && selectedAssignmentId) {
        if (!recheckingAllRef.current && !recheckingSubIdRef.current && !triggeringRef.current) {
          loadEvalGrades(selectedAssignmentId, true);
        }
      } else if (!isTeacher) {
        loadStudentGrades();
      }
    };
    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleFocus();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isTeacher, activeTab, selectedAssignmentId]);

  const handleCopyCode = () => {
    if (!classData) return;
    navigator.clipboard.writeText(classData.code);
    setCopiedCode(true);
    setToast({ message: `Class code "${classData.code}" copied!`, type: 'success' });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleAssignmentCreated = (newAss) => {
    setAssignments((prev) => [...prev, newAss]);
    if (!selectedAssignmentId) setSelectedAssignmentId(newAss.id);
    setShowCreateAssignmentModal(false);
    setToast({ message: `Assignment "${newAss.title}" published!`, type: 'success' });
  };

  const handleAssignmentUpdated = (updatedAss) => {
    setAssignments((prev) => prev.map((a) => (a.id === updatedAss.id ? updatedAss : a)));
    setEditingAssignment(null);
    setToast({ message: `Assignment "${updatedAss.title}" updated successfully!`, type: 'success' });
  };

  const handleStudentUpload = async (assignmentId) => {
    if (!selectedFile) {
      setToast({ message: 'Please select a .ipynb file first', type: 'error' });
      return;
    }
    setUploadSubmitting(true);
    try {
      await uploadSubmissionApi(assignmentId, selectedFile);
      setToast({ message: 'Notebook submitted successfully!', type: 'success' });
      setSelectedFile(null);
      setUploadingAssignmentId(null);
      // Refresh my grades
      const updatedGrades = await getMyGradesApi();
      setStudentGrades(updatedGrades);
    } catch (err) {
      setToast({ message: err.message || 'Upload failed', type: 'error' });
    } finally {
      setUploadSubmitting(false);
    }
  };

  const currentAssignment = useMemo(() => {
    return assignments.find((a) => a.id === selectedAssignmentId) || null;
  }, [assignments, selectedAssignmentId]);

  useEffect(() => {
    if (currentAssignment && !editingPromptRubric) {
      setPromptLlmDesc(currentAssignment.llm_prompt || '');
      setPromptRubric(currentAssignment.rubric_text || '');
      setPromptPlagiarism(currentAssignment.plagiarism_policy || '');
    }
  }, [currentAssignment?.id, currentAssignment?.llm_prompt, currentAssignment?.rubric_text, currentAssignment?.plagiarism_policy, editingPromptRubric]);

  const handleSavePromptRubric = async () => {
    if (!selectedAssignmentId) return;
    setSavingPrompt(true);
    try {
      const updated = await updateAssignmentApi(selectedAssignmentId, {
        llm_prompt: promptLlmDesc,
        rubric_text: promptRubric,
        plagiarism_policy: promptPlagiarism,
      });
      setAssignments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setPromptLlmDesc(updated.llm_prompt || '');
      setPromptRubric(updated.rubric_text || '');
      setPromptPlagiarism(updated.plagiarism_policy || '');
      setEditingPromptRubric(false);
      setToast({ message: 'LLM Grading Prompt, Marking Rubric & Plagiarism Policy saved successfully!', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to save prompt/rubric', type: 'error' });
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleRecheckSingle = async (submissionId) => {
    setConfirmRecheckSub(null);
    setRecheckingSubId(submissionId);
    setQuotaError(null);

    // Immediately show 'processing' status badge on this student's row
    setEvalGrades((prev) =>
      prev.map((g) =>
        g.submission_id === submissionId ? { ...g, submission_status: 'processing' } : g
      )
    );

    try {
      const updatedGrade = await recheckSubmissionApi(submissionId);
      // Fetch fresh grades first so table data, buttons, and toast update simultaneously
      const freshGrades = await getAdminAssignmentGradesApi(selectedAssignmentId);
      setEvalGrades(freshGrades);
      setRecheckingSubId(null);
      setToast({ message: `Re-evaluated notebook for ${updatedGrade.student_name}! Status: Graded (${updatedGrade.marks}/${updatedGrade.max_marks})`, type: 'success' });
    } catch (err) {
      const errMsg = err.message || '';
      try {
        const freshGrades = await getAdminAssignmentGradesApi(selectedAssignmentId);
        setEvalGrades(freshGrades);
      } catch {}
      setRecheckingSubId(null);
      if (errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
        setQuotaError(errMsg);
        setToast({
          message: '⚠️ Daily free AI grading quota ended. Resets daily at 00:00 UTC (5:30 AM IST).',
          type: 'error',
          duration: 8000,
        });
      } else {
        setToast({ message: errMsg || 'Recheck failed', type: 'error' });
      }
    }
  };

  const handleRecheckAll = async () => {
    setConfirmRecheckAll(false);
    if (!selectedAssignmentId) return;
    setRecheckingAll(true);
    setQuotaError(null);

    // Immediately show 'processing' status badge on all submitted student rows
    setEvalGrades((prev) =>
      prev.map((g) => (g.submission_status !== 'no_submission' ? { ...g, submission_status: 'processing' } : g))
    );

    try {
      await recheckAllAssignmentApi(selectedAssignmentId);
      // Fetch fresh grades first so table statuses, recheck all button, individual buttons and popup toast update simultaneously
      const freshGrades = await getAdminAssignmentGradesApi(selectedAssignmentId);
      setEvalGrades(freshGrades);
      setRecheckingAll(false);
      setToast({ message: 'Recheck completed for all student submissions using latest rubric!', type: 'success' });
    } catch (err) {
      const errMsg = err.message || '';
      try {
        const freshGrades = await getAdminAssignmentGradesApi(selectedAssignmentId);
        setEvalGrades(freshGrades);
      } catch {}
      setRecheckingAll(false);
      if (errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
        setQuotaError(errMsg);
        setToast({
          message: '⚠️ Daily free AI grading quota ended across all models. Resets daily at 00:00 UTC (5:30 AM IST).',
          type: 'error',
          duration: 8000,
        });
      } else {
        setToast({ message: errMsg || 'Recheck all failed', type: 'error' });
      }
    }
  };

  const handleTriggerGrading = async () => {
    if (!selectedAssignmentId) return;
    setTriggering(true);
    setQuotaError(null);

    // Immediately mark pending rows as processing
    setEvalGrades((prev) =>
      prev.map((g) => g.submission_status === 'pending' ? { ...g, submission_status: 'processing' } : g)
    );

    try {
      const res = await triggerGradingApi(selectedAssignmentId, directMode);
      const freshGrades = await getAdminAssignmentGradesApi(selectedAssignmentId);
      setEvalGrades(freshGrades);
      setTriggering(false);
      setToast({
        message: directMode ? 'Grading completed!' : 'Batch grading queued!',
        type: 'success',
      });
    } catch (err) {
      const errMsg = err.message || '';
      try {
        const freshGrades = await getAdminAssignmentGradesApi(selectedAssignmentId);
        setEvalGrades(freshGrades);
      } catch {}
      setTriggering(false);
      if (errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
        setQuotaError(errMsg);
        setToast({
          message: '⚠️ Daily free AI grading quota ended. Resets daily at 00:00 UTC (5:30 AM IST).',
          type: 'error',
          duration: 8000,
        });
      } else {
        setToast({ message: errMsg || 'Grading failed', type: 'error' });
      }
    }
  };

  const handlePublishResults = async (publish = true) => {
    if (!selectedAssignmentId) return;
    setPublishingResults(true);
    try {
      let updated;
      if (publish) {
        updated = await publishAssignmentResultsApi(selectedAssignmentId);
        setToast({ message: '🎉 Results published! Students can now view their scores and AI feedback.', type: 'success' });
      } else {
        updated = await unpublishAssignmentResultsApi(selectedAssignmentId);
        setToast({ message: 'Results unpublished. Students will now see "Result Pending".', type: 'info' });
      }
      setAssignments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setShowPublishModal(false);
    } catch (err) {
      setToast({ message: err.message || 'Failed to update result publish status', type: 'error' });
    } finally {
      setPublishingResults(false);
    }
  };

  const handleDownloadSingle = async (item) => {
    if (!item.submission_id) return;
    setDownloadingSubId(item.submission_id);
    try {
      const fname = `${item.student_id}_submission.ipynb`;
      await downloadSingleSubmissionApi(item.submission_id, fname);
      setToast({ message: `Downloaded notebook for ${item.student_name}`, type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to download notebook', type: 'error' });
    } finally {
      setDownloadingSubId(null);
    }
  };

  const handleDownloadAllZip = async () => {
    if (!selectedAssignmentId || !currentAssignment) return;
    setDownloadingZip(true);
    try {
      const zipName = `${currentAssignment.title.replace(/[^a-zA-Z0-9-_]/g, '_')}_all_submissions.zip`;
      await downloadAllSubmissionsZipApi(selectedAssignmentId, zipName);
      setToast({ message: '📦 Downloaded all submissions ZIP archive!', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to download ZIP archive', type: 'error' });
    } finally {
      setDownloadingZip(false);
    }
  };

  // Stats for evaluation tab
  const evalStats = useMemo(() => {
    const total = evalGrades.length;
    const graded = evalGrades.filter((g) => g.marks !== null && g.submission_status !== 'no_submission').length;
    const noSubmission = evalGrades.filter((g) => g.submission_status === 'no_submission').length;
    const flagged = evalGrades.filter((g) => g.flagged).length;
    const pending = evalGrades.filter((g) => g.submission_status === 'pending').length;
    let avgMarks = 0;
    if (graded > 0) {
      const sum = evalGrades.filter((g) => g.submission_status !== 'no_submission').reduce((acc, g) => acc + (g.marks || 0), 0);
      avgMarks = (sum / graded).toFixed(1);
    }
    return { total, graded, noSubmission, flagged, pending, avgMarks };
  }, [evalGrades]);

  const filteredGrades = useMemo(() => {
    return evalGrades.filter((g) => {
      const matchesSearch =
        g.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.student_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(g.student_id).includes(searchQuery);
      let matchesStatus = true;
      if (statusFilter === 'flagged') matchesStatus = g.flagged;
      else if (statusFilter === 'pending') matchesStatus = g.submission_status === 'pending';
      else if (statusFilter === 'graded') matchesStatus = g.marks !== null && g.submission_status !== 'no_submission';
      else if (statusFilter === 'no_submission') matchesStatus = g.submission_status === 'no_submission';
      return matchesSearch && matchesStatus;
    });
  }, [evalGrades, searchQuery, statusFilter]);

  if (loading) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px', background: 'transparent' }}>
        <button
          onClick={onBack}
          className="btn-ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '0.88rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back to All Classes</span>
        </button>
        <LoadingSpinner text="Loading class details & assignments..." size={60} minHeight="55vh" delay={300} />
      </div>
    );
  }

  if (!classData) {
    return (
      <div style={{ maxWidth: '800px', margin: '60px auto', textAlign: 'center' }}>
        <h2>Class Not Found</h2>
        <button onClick={onBack} className="btn-secondary" style={{ marginTop: '16px' }}>
          Back to Classes
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {showCreateAssignmentModal && (
        <CreateClassAssignmentModal
          classId={classId}
          onClose={() => setShowCreateAssignmentModal(false)}
          onCreated={handleAssignmentCreated}
        />
      )}

      {editingAssignment && (
        <EditAssignmentModal
          assignment={editingAssignment}
          onClose={() => setEditingAssignment(null)}
          onUpdated={handleAssignmentUpdated}
        />
      )}

      {editingGrade && (
        <EditGradeModal
          gradeItem={editingGrade}
          onClose={() => setEditingGrade(null)}
          onSaveSuccess={() => {
            setEditingGrade(null);
            loadEvalGrades(selectedAssignmentId);
            setToast({ message: 'Grade updated successfully!', type: 'success' });
          }}
        />
      )}

      {inspectingFlag && (
        <SimilarityFlagModal
          gradeItem={inspectingFlag}
          onClose={() => setInspectingFlag(null)}
        />
      )}

      {/* Back button breadcrumb */}
      <button
        onClick={onBack}
        className="btn-ghost"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '0.88rem' }}
      >
        <ArrowLeft size={16} />
        <span>Back to All Classes</span>
      </button>

      {/* Class Banner Header */}
      <div
        style={{
          background: classData.color || 'linear-gradient(135deg, #4f46e5, #06b6d4)',
          borderRadius: '16px',
          padding: '32px',
          color: '#fff',
          marginBottom: '24px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '20px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: '800', lineHeight: '1.2', margin: '0 0 8px 0' }}>
            {classData.name}
          </h1>
          <div style={{ fontSize: '0.95rem', opacity: 0.95 }}>
            Instructor: <strong>{classData.teacher_name}</strong>
          </div>
        </div>

        {/* Class Code Box */}
        <div
          style={{
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '12px',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>
              Class Code
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', fontFamily: 'var(--font-mono)', letterSpacing: '2px' }}>
              {classData.code}
            </div>
          </div>
          <button
            onClick={handleCopyCode}
            className="btn-ghost"
            style={{ color: '#fff', padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.15)' }}
            title="Copy code"
          >
            {copiedCode ? <Check size={18} color="#10b981" /> : <Copy size={18} />}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '28px' }}>
        <button
          onClick={() => setActiveTab('classwork')}
          className={`tab-btn ${activeTab === 'classwork' ? 'tab-btn-active' : ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 20px', fontWeight: '600', fontSize: '0.92rem' }}
        >
          <BookOpen size={18} />
          <span>Classwork & Submissions</span>
          <span className="badge badge-graded" style={{ padding: '2px 8px', fontSize: '0.72rem' }}>
            {assignments.length}
          </span>
        </button>

        {isTeacher && (
          <button
            id="evaluation-tab-btn"
            onClick={() => setActiveTab('evaluation')}
            className={`tab-btn ${activeTab === 'evaluation' ? 'tab-btn-active' : ''}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 20px', fontWeight: '600', fontSize: '0.92rem' }}
          >
            <Cpu size={18} />
            <span>Notebook Evaluation & Grading</span>
            <span className="badge badge-pending" style={{ padding: '2px 8px', fontSize: '0.72rem' }}>
              TA Checker
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('people')}
          className={`tab-btn ${activeTab === 'people' ? 'tab-btn-active' : ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 20px', fontWeight: '600', fontSize: '0.92rem' }}
        >
          <Users size={18} />
          <span>People</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            ({students.length} students)
          </span>
        </button>
      </div>

      {/* TAB 1: CLASSWORK & SUBMISSIONS */}
      {activeTab === 'classwork' && (
        <div>
          {isTeacher && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
              <button
                id="create-class-assignment-btn"
                onClick={() => setShowCreateAssignmentModal(true)}
                className="btn-primary"
                style={{ padding: '10px 18px' }}
              >
                <Plus size={18} />
                <span>Publish New Assignment</span>
              </button>
            </div>
          )}

          {assignments.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 24px', borderRadius: '16px' }}>
              <BookOpen size={44} style={{ color: 'var(--text-dim)', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '8px' }}>No Assignments Yet</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {isTeacher
                  ? 'Click "Publish New Assignment" to upload student handouts and setup the rubric.'
                  : 'Your instructor has not posted any assignments for this class yet.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {assignments.map((ass) => {
                const myGrade = studentGrades.find((g) => g.assignment_id === ass.id);
                const isUploaded = Boolean(myGrade);
                const isGraded = Boolean(ass.results_published && myGrade?.marks !== null && myGrade?.marks !== undefined);

                return (
                  <div key={ass.id} className="glass-panel" style={{ padding: '24px', borderRadius: '14px', borderLeft: '4px solid var(--primary)' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '14px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>{ass.title}</h3>
                          <span className="badge badge-graded" style={{ fontSize: '0.78rem' }}>
                            {ass.max_marks} marks
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <Clock size={14} />
                            Due: {new Date(ass.deadline).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Status badge for students */}
                      {!isTeacher && (
                        <div>
                          {isGraded ? (
                            <span className="badge badge-graded" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                              Score: {myGrade.marks} / {myGrade.max_marks}
                            </span>
                          ) : isUploaded ? (
                            <span className="badge badge-pending" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                              Turned In ({myGrade.status})
                            </span>
                          ) : (
                            <span className="badge badge-error" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                              Not Submitted
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Task Description */}
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '18px' }}>
                      {ass.description}
                    </p>

                    {/* Action Row: Handout PDF + Rubric View + Teacher Edit */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                      {ass.has_attachment && (
                        <a
                          href={getAssignmentAttachmentUrl(ass.id)}
                          download={ass.attachment_name || 'lab_handout.pdf'}
                          className="btn-secondary"
                          style={{ fontSize: '0.84rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        >
                          <FileDown size={16} color="var(--accent-cyan)" />
                          <span>Download Lab Handout ({ass.attachment_name})</span>
                        </a>
                      )}

                      {isTeacher && ass.rubric_text && (
                        <button
                          onClick={() => setExpandedRubric((prev) => ({ ...prev, [ass.id]: !prev[ass.id] }))}
                          className="btn-secondary"
                          style={{
                            fontSize: '0.84rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '7px',
                            ...(expandedRubric[ass.id] ? {
                              borderColor: 'var(--border-active)',
                              background: 'var(--bg-card-hover)',
                              color: 'var(--primary)',
                            } : {})
                          }}
                        >
                          <FileText size={16} color={expandedRubric[ass.id] ? 'var(--primary)' : 'var(--accent-cyan)'} />
                          <span>{expandedRubric[ass.id] ? 'Hide Grading Rubric' : 'View Grading Rubric'}</span>
                          {expandedRubric[ass.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}

                      {isTeacher && (
                        <button
                          onClick={() => setEditingAssignment(ass)}
                          className="btn-secondary"
                          style={{
                            fontSize: '0.84rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Edit3 size={16} color="var(--primary)" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>

                    {/* Collapsible Rubric (Teacher Only) */}
                    {isTeacher && expandedRubric[ass.id] && (
                      <div style={{
                        padding: '16px 20px',
                        background: 'var(--bg-surface)',
                        borderRadius: '12px',
                        marginBottom: '18px',
                        border: '1px solid var(--border-subtle)',
                        boxShadow: 'var(--shadow-card)'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.78rem',
                          color: 'var(--primary)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          fontWeight: '700',
                          marginBottom: '10px'
                        }}>
                          <FileText size={15} />
                          <span>Grading Rubric Criteria (Private / Teacher View)</span>
                        </div>
                        <pre style={{
                          margin: 0,
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.86rem',
                          color: 'var(--text-main)',
                          whiteSpace: 'pre-wrap',
                          lineHeight: '1.55',
                          background: 'var(--input-bg)',
                          padding: '14px 16px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)'
                        }}>
                          {ass.rubric_text}
                        </pre>
                      </div>
                    )}

                    {/* Student Notebook & Grading 2-Card Display */}
                    {!isTeacher && (() => {
                      const isPastDeadline = new Date() > new Date(ass.deadline);
                      const isSelectedForThis = uploadingAssignmentId === ass.id && selectedFile;

                      return (
                        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '18px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {/* ── CARD 1: SUBMISSION / TURNED IN FILE ── */}
                          <div style={{
                            padding: '16px 20px',
                            background: isUploaded ? 'rgba(255, 106, 0, 0.05)' : 'var(--bg-surface)',
                            borderRadius: '12px',
                            border: isUploaded ? '1px solid rgba(255, 106, 0, 0.25)' : '1px solid var(--border-subtle)',
                            boxShadow: 'var(--shadow-card)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Upload size={16} color="var(--primary)" />
                                <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--primary)' }}>
                                  1. Your Submission (Turned In File)
                                </span>
                              </div>
                              {isUploaded ? (
                                <span className="badge badge-graded" style={{ fontSize: '0.74rem' }}>
                                  ✓ File Turned In
                                </span>
                              ) : (
                                <span className="badge badge-error" style={{ fontSize: '0.74rem' }}>
                                  Not Submitted
                                </span>
                              )}
                            </div>

                            {isUploaded ? (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '12px 14px', borderRadius: '10px', marginBottom: '12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <FileText size={20} color="var(--primary)" />
                                    <div>
                                      <div style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-main)' }}>
                                        {myGrade.file_name || 'demolab.ipynb'}
                                      </div>
                                      <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                                        Turned in: {new Date(myGrade.submitted_at).toLocaleString()}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Replace / Resubmit Controls (Active before deadline) */}
                                {!isPastDeadline ? (
                                  <div style={{ borderTop: '1px dashed rgba(255, 106, 0, 0.25)', paddingTop: '12px', marginTop: '8px' }}>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                      Need to change your submission? You can replace it before the deadline:
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                                      <label
                                        className="btn-secondary"
                                        style={{ cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}
                                      >
                                        <RotateCw size={14} />
                                        <span>{isSelectedForThis ? 'Choose Different File' : 'Choose Replacement .ipynb'}</span>
                                        <input
                                          type="file"
                                          accept=".ipynb"
                                          style={{ display: 'none' }}
                                          onChange={(e) => {
                                            setSelectedFile(e.target.files[0] || null);
                                            setUploadingAssignmentId(ass.id);
                                          }}
                                        />
                                      </label>

                                      {isSelectedForThis && (
                                        <>
                                          <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '600' }}>
                                            Selected: {selectedFile.name}
                                          </span>
                                          <button
                                            onClick={() => handleStudentUpload(ass.id)}
                                            disabled={uploadSubmitting}
                                            className="btn-primary"
                                            style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                                          >
                                            {uploadSubmitting ? 'Replacing...' : 'Confirm & Replace File'}
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '0.78rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Clock size={14} />
                                    <span>Deadline has passed. Submission is now locked and cannot be replaced.</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* Not yet uploaded */
                              <div>
                                {!isPastDeadline ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <label
                                        className="btn-secondary"
                                        style={{ cursor: 'pointer', fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                                      >
                                        <Upload size={16} />
                                        <span>{isSelectedForThis ? selectedFile.name : 'Choose .ipynb Notebook'}</span>
                                        <input
                                          type="file"
                                          accept=".ipynb"
                                          style={{ display: 'none' }}
                                          onChange={(e) => {
                                            setSelectedFile(e.target.files[0] || null);
                                            setUploadingAssignmentId(ass.id);
                                          }}
                                        />
                                      </label>
                                      {isSelectedForThis && (
                                        <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: '600' }}>
                                          Ready ({(selectedFile.size / 1024).toFixed(0)} KB)
                                        </span>
                                      )}
                                    </div>

                                    <button
                                      onClick={() => handleStudentUpload(ass.id)}
                                      disabled={uploadSubmitting || !isSelectedForThis}
                                      className="btn-primary"
                                      style={{ fontSize: '0.84rem', padding: '8px 18px' }}
                                    >
                                      {uploadSubmitting ? 'Uploading...' : 'Turn In Notebook'}
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '0.82rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Clock size={14} />
                                    <span>Deadline passed on {new Date(ass.deadline).toLocaleString()}. Submissions are closed.</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* ── CARD 2: EVALUATION / RESULT STATUS (KEPT SEPARATE) ── */}
                          <div style={{
                            padding: '16px 20px',
                            background: isGraded ? 'rgba(34, 197, 94, 0.05)' : 'var(--bg-surface)',
                            borderRadius: '12px',
                            border: isGraded ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid var(--border-subtle)',
                            boxShadow: 'var(--shadow-card)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Sparkles size={16} color={isGraded ? '#4ade80' : 'var(--primary)'} />
                                <span style={{ fontSize: '0.88rem', fontWeight: '700', color: isGraded ? '#4ade80' : 'var(--primary)' }}>
                                  2. Evaluation & Grade Result
                                </span>
                              </div>
                              {isGraded ? (
                                <span className="badge badge-graded" style={{ fontSize: '0.85rem', padding: '4px 12px', fontWeight: '700' }}>
                                  Score: {myGrade.marks} / {myGrade.max_marks}
                                </span>
                              ) : isUploaded ? (
                                <span className="badge badge-pending" style={{ fontSize: '0.78rem' }}>
                                  ⏳ Result Pending
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                                  Awaiting Submission
                                </span>
                              )}
                            </div>

                            {!isUploaded ? (
                              <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                                Turn in your Jupyter notebook above to receive an AI evaluation and score breakdown.
                              </div>
                            ) : !isGraded ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(255, 106, 0, 0.08)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                                <Clock size={16} color="var(--primary)" />
                                <div style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>
                                  <strong>Result Pending:</strong> Your notebook has been submitted successfully and is queued for AI grading by your instructor.
                                </div>
                              </div>
                            ) : (
                              /* Graded Feedback */
                              <div>
                                {myGrade.reasoning_text && (
                                  <div style={{ padding: '14px 16px', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ fontSize: '0.76rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontWeight: '700' }}>
                                      AI Feedback Breakdown:
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-main)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                      {myGrade.reasoning_text}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: NOTEBOOK EVALUATION & GRADING (TEACHER ONLY) */}
      {activeTab === 'evaluation' && isTeacher && (
        <div>
          {/* Assignment Selector & Global Actions Bar */}
          <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '14px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                Select Assignment:
              </label>
              <select
                value={selectedAssignmentId || ''}
                onChange={(e) => setSelectedAssignmentId(parseInt(e.target.value))}
                className="form-input"
                style={{ minWidth: '260px', fontWeight: '600' }}
              >
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({a.max_marks} marks)
                  </option>
                ))}
              </select>
              <button onClick={() => loadEvalGrades(selectedAssignmentId)} className="btn-secondary" title="Refresh Evaluation Table">
                <RefreshCw size={16} className={evalLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Evaluation Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Recheck All Button */}
              <button
                onClick={() => setConfirmRecheckAll(true)}
                disabled={recheckingAll || evalGrades.length === 0}
                className="btn-secondary"
                style={{
                  padding: '9px 20px',
                  fontSize: '0.88rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderColor: 'rgba(99, 102, 241, 0.45)',
                  background: recheckingAll ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.12)',
                  color: 'var(--primary)',
                  boxShadow: recheckingAll ? '0 0 16px rgba(99, 102, 241, 0.4)' : 'none',
                  cursor: recheckingAll ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title="Re-evaluate all student submissions using the latest Prompt & Rubric"
              >
                {recheckingAll ? (
                  <>
                    <img
                      src={isLight ? lightRecheckAllSvg : darkRecheckAllSvg}
                      alt="Re-evaluating..."
                      style={{ width: '18px', height: '18px', display: 'inline-block', verticalAlign: 'middle' }}
                    />
                    <span style={{ fontWeight: '700' }}>Re-evaluating All Submissions...</span>
                  </>
                ) : (
                  <>
                    <RotateCw size={16} />
                    <span>Recheck All (Latest Rubric)</span>
                  </>
                )}
              </button>

              {/* Trigger Grading Button for Pending Submissions */}
              <button
                id="trigger-grading-class-btn"
                onClick={handleTriggerGrading}
                disabled={triggering || evalStats.pending === 0}
                className="btn-primary"
                style={{ padding: '9px 18px', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                {triggering ? (
                  <>
                    <div className="animate-spin" style={{ width: '16px', height: '16px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} />
                    <span>Grading with AI...</span>
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    <span>Grade Pending ({evalStats.pending})</span>
                  </>
                )}
              </button>

              {/* Download All Submissions (ZIP) Button */}
              {currentAssignment && (
                <button
                  onClick={handleDownloadAllZip}
                  disabled={downloadingZip || evalGrades.filter((g) => g.submission_id).length === 0}
                  className="btn-secondary"
                  style={{
                    padding: '9px 18px',
                    fontSize: '0.88rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderColor: 'rgba(6, 182, 212, 0.45)',
                    background: 'rgba(6, 182, 212, 0.1)',
                    color: 'var(--accent-cyan)',
                    fontWeight: '600'
                  }}
                  title="Download a ZIP archive containing all uploaded student notebook files"
                >
                  {downloadingZip ? (
                    <>
                      <div className="animate-spin" style={{ width: '15px', height: '15px', border: '2px solid var(--accent-cyan)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                      <span>Downloading ZIP...</span>
                    </>
                  ) : (
                    <>
                      <FileDown size={16} />
                      <span>Download All (.zip)</span>
                    </>
                  )}
                </button>
              )}

              {/* Publish Results to Students Button */}
              {currentAssignment && (
                !currentAssignment.results_published ? (
                  <button
                    onClick={() => setShowPublishModal(true)}
                    disabled={publishingResults || evalGrades.length === 0}
                    className="btn-primary"
                    style={{
                      padding: '9px 20px',
                      fontSize: '0.88rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                      borderColor: '#10b981',
                      boxShadow: '0 0 16px rgba(16, 185, 129, 0.25)',
                      fontWeight: '700'
                    }}
                    title="Publish evaluated grades and feedback to students"
                  >
                    <Send size={16} />
                    <span>Publish Results to Students</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handlePublishResults(false)}
                    disabled={publishingResults}
                    className="btn-secondary"
                    style={{
                      padding: '9px 16px',
                      fontSize: '0.88rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderColor: 'rgba(16, 185, 129, 0.5)',
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#34d399',
                    }}
                    title="Results are currently visible to students. Click to unpublish."
                  >
                    <CheckCircle2 size={16} color="#34d399" />
                    <span>Results Published (Unpublish)</span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* EDITABLE PROMPT & RUBRIC CARD */}
          {currentAssignment && (
            <div className="glass-panel" style={{ padding: '22px 24px', borderRadius: '14px', marginBottom: '24px', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={18} color="var(--primary)" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-bright)' }}>
                      LLM Grading Prompt, Marking Rubric & Integrity Policy
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                      Individual rechecks evaluate academic merit; batch rechecks also apply the cheating policy
                    </span>
                  </div>
                </div>

                {/* Edit / Save Actions for Prompt & Rubric */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {!editingPromptRubric ? (
                    <button
                      onClick={() => setEditingPromptRubric(true)}
                      className="btn-secondary"
                      style={{ padding: '7px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Edit3 size={14} />
                      <span>Edit Prompts & Rubrics</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setPromptLlmDesc(currentAssignment.llm_prompt || '');
                          setPromptRubric(currentAssignment.rubric_text || '');
                          setPromptPlagiarism(currentAssignment.plagiarism_policy || '');
                          setEditingPromptRubric(false);
                        }}
                        disabled={savingPrompt}
                        className="btn-ghost"
                        style={{ padding: '7px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <X size={14} />
                        <span>Cancel</span>
                      </button>
                      <button
                        onClick={handleSavePromptRubric}
                        disabled={savingPrompt}
                        className="btn-primary"
                        style={{ padding: '7px 16px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        {savingPrompt ? (
                          <>
                            <div className="animate-spin" style={{ width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Save size={14} />
                            <span>Save Changes</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Prompt, Marking Rubric & Cheating Policy Form / Display */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '18px' }}>
                {/* 1. Lab Task Description (Prompt to LLM) */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--accent-cyan)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={15} />
                    <span>1. Lab Task Description (LLM Prompt)</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
                    Private prompt for AI grading (hidden from students)
                  </div>

                  {editingPromptRubric ? (
                    <textarea
                      value={promptLlmDesc}
                      onChange={(e) => setPromptLlmDesc(e.target.value)}
                      rows={5}
                      className="form-input"
                      style={{ width: '100%', fontSize: '0.84rem', fontFamily: 'inherit', resize: 'vertical' }}
                      placeholder="Enter the lab task instructions and evaluation context for the LLM..."
                    />
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6', whiteSpace: 'pre-wrap', maxHeight: '160px', overflowY: 'auto' }}>
                      {currentAssignment.llm_prompt || currentAssignment.description || 'No LLM prompt provided. Click Edit to enter instructions for AI grading.'}
                    </div>
                  )}
                </div>

                {/* 2. Academic Marking Rubric */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={15} />
                    <span>2. Academic Marking Rubric (Max: {currentAssignment.max_marks})</span>
                  </div>

                  {editingPromptRubric ? (
                    <textarea
                      value={promptRubric}
                      onChange={(e) => setPromptRubric(e.target.value)}
                      rows={5}
                      className="form-input"
                      style={{ width: '100%', fontSize: '0.84rem', fontFamily: 'inherit', resize: 'vertical' }}
                      placeholder="Enter marking criteria (e.g. integer marks {7, 8, 9, 10})..."
                    />
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6', whiteSpace: 'pre-wrap', maxHeight: '160px', overflowY: 'auto' }}>
                      {currentAssignment.rubric_text || 'No rubric text provided.'}
                    </div>
                  )}
                </div>

                {/* 3. Cheating & Plagiarism Policy */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#f59e0b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={15} />
                    <span>3. Cheating & Plagiarism Policy (Batch Check)</span>
                  </div>

                  {editingPromptRubric ? (
                    <textarea
                      value={promptPlagiarism}
                      onChange={(e) => setPromptPlagiarism(e.target.value)}
                      rows={5}
                      className="form-input"
                      style={{ width: '100%', fontSize: '0.84rem', fontFamily: 'inherit', resize: 'vertical' }}
                      placeholder="Enter cheating policy (e.g. flag only 100% word-for-word copy cases and award 0 marks)..."
                    />
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6', whiteSpace: 'pre-wrap', maxHeight: '160px', overflowY: 'auto' }}>
                      {currentAssignment.plagiarism_policy || 'Flag only 100% verbatim copy cases with 0 marks.'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quota Exhaustion Alert Banner */}
          {quotaError && (
            <div style={{ padding: '16px 20px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '12px', marginBottom: '22px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <AlertTriangle size={22} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: '700', color: '#f87171', fontSize: '0.96rem', marginBottom: '3px' }}>
                    Daily AI Grading Quota Reached
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-bright)', lineHeight: '1.45' }}>
                    The daily request quota has been reached across available Google Gemini models.
                    Free quotas automatically reset daily at <strong>00:00 UTC (5:30 AM IST)</strong>.
                    You can also paste an alternative Gemini API key in your <code>.env</code> file.
                  </div>
                </div>
              </div>
              <button onClick={() => setQuotaError(null)} className="btn-ghost" style={{ padding: '4px 8px' }} title="Dismiss">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Submissions</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', marginTop: '4px' }}>{evalStats.total}</div>
            </div>
            <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Graded</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', marginTop: '4px', color: '#10b981' }}>{evalStats.graded}</div>
            </div>
            <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Copy Cases / Flags</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', marginTop: '4px', color: '#f59e0b' }}>{evalStats.flagged}</div>
            </div>
            <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Class Average</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', marginTop: '4px', color: 'var(--accent-cyan)' }}>{evalStats.avgMarks}</div>
            </div>
          </div>

          {/* Copy Cases Warning Banner if any flagged */}
          {evalStats.flagged > 0 && (
            <div style={{ padding: '14px 18px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertTriangle size={20} color="#f59e0b" />
              <span style={{ fontSize: '0.88rem', color: '#fbbf24' }}>
                <strong>{evalStats.flagged} student submission(s)</strong> flagged for high code similarity with fellow classmates. Partner Student IDs and Email IDs are shown in the AI reasoning below.
              </span>
            </div>
          )}

            {/* Grades Table */}
          <div className="glass-panel" style={{ borderRadius: '14px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '14px 18px', fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Student</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Marks</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Notebook</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>AI Reasoning & Evaluation</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGrades.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No submissions found for this assignment.
                    </td>
                  </tr>
                ) : (
                  filteredGrades.map((item) => {
                    const isNoSub = item.submission_status === 'no_submission' || !item.submission_id;
                    const isThisRechecking =
                      (!isNoSub && recheckingSubId === item.submission_id) ||
                      (recheckingAll && !isNoSub) ||
                      item.submission_status === 'processing';

                    return (
                      <tr key={item.submission_id || item.student_id} style={{ borderBottom: '1px solid var(--border-subtle)', background: isNoSub ? 'rgba(239, 68, 68, 0.02)' : 'transparent' }}>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: '600' }}>{item.student_name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                            ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{item.student_id}</span> &bull; {item.student_email}
                          </div>
                        </td>

                        <td style={{ padding: '14px 18px' }}>
                          {isNoSub ? (
                            <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 10px', fontSize: '0.74rem' }}>
                              No Submission
                            </span>
                          ) : isThisRechecking ? (
                            <span className="badge badge-processing">
                              <img
                                src={isLight ? pinkLoadingSvg : lavenderLoadingSvg}
                                alt="processing"
                                style={{
                                  width: '13px',
                                  height: '13px',
                                  display: 'inline-block',
                                  verticalAlign: 'middle',
                                  marginRight: '5px'
                                }}
                              />
                              processing
                            </span>
                          ) : (
                            <span className={`badge badge-${item.submission_status}`}>
                              {item.submission_status}
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                          {item.marks !== null ? (
                            <span style={{ color: item.marks / item.max_marks >= 0.7 ? '#10b981' : item.marks === 0 ? '#ef4444' : '#f59e0b' }}>
                              {item.marks} / {item.max_marks}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-dim)' }}>—</span>
                          )}
                        </td>

                        {/* Individual Student Notebook Download */}
                        <td style={{ padding: '14px 18px' }}>
                          {!isNoSub ? (
                            <button
                              onClick={() => handleDownloadSingle(item)}
                              disabled={downloadingSubId === item.submission_id}
                              className="btn-secondary"
                              style={{
                                padding: '5px 12px',
                                fontSize: '0.78rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                borderColor: 'rgba(6, 182, 212, 0.45)',
                                background: 'rgba(6, 182, 212, 0.08)',
                                color: 'var(--accent-cyan)',
                                borderRadius: '8px'
                              }}
                              title={`Download ${item.student_name}'s uploaded .ipynb file`}
                            >
                              {downloadingSubId === item.submission_id ? (
                                <div className="animate-spin" style={{ width: '12px', height: '12px', border: '2px solid var(--accent-cyan)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                              ) : (
                                <FileDown size={13} />
                              )}
                              <span>.ipynb</span>
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-dim)', fontWeight: '700', paddingLeft: '8px' }}>—</span>
                          )}
                        </td>

                        <td style={{ padding: '14px 18px', maxWidth: '380px' }}>
                          {item.reasoning_text ? (
                            <div>
                              {/* Copy case alert badge if flagged */}
                              {item.flagged && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '3px 8px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '700', marginBottom: '6px' }}>
                                  <AlertTriangle size={12} />
                                  <span>Copy Case Detected</span>
                                </div>
                              )}

                              <div style={{ fontSize: '0.84rem', color: isNoSub ? '#f87171' : item.flagged ? '#fca5a5' : 'var(--text-bright)', lineHeight: '1.45' }}>
                                {item.reasoning_text}
                              </div>

                              {/* Additional Flag Reason Inspector if available */}
                              {item.flag_reason && item.flag_reason !== item.reasoning_text && (
                                <div style={{ marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-dim)', background: 'rgba(0,0,0,0.25)', padding: '6px 10px', borderRadius: '6px' }}>
                                  <strong>Details:</strong> {item.flag_reason}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Awaiting grading</span>
                          )}
                        </td>

                        {/* Action Buttons: Recheck & Edit */}
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            {/* Recheck Button */}
                            <button
                              onClick={() => setConfirmRecheckSub(item)}
                              disabled={isNoSub || isThisRechecking}
                              className="btn-secondary"
                              style={{
                                padding: '6px 12px',
                                fontSize: '0.78rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                borderColor: isThisRechecking
                                  ? (isLight ? 'rgba(255, 106, 0, 0.45)' : 'rgba(99, 102, 241, 0.45)')
                                  : 'var(--border-subtle)',
                                color: isNoSub ? 'var(--text-dim)' : 'var(--primary)',
                                opacity: isNoSub ? 0.4 : 1,
                                cursor: isNoSub || isThisRechecking ? 'not-allowed' : 'pointer',
                                minWidth: isThisRechecking ? '58px' : 'auto'
                              }}
                              title={
                                isNoSub
                                  ? 'Cannot recheck: student did not submit a notebook'
                                  : isThisRechecking
                                  ? 'Currently re-evaluating notebook...'
                                  : 'Recheck this student submission with latest prompt & rubric'
                              }
                            >
                              {isThisRechecking ? (
                                <img
                                  src={isLight ? orangeRecheckSvg : blueRecheckSvg}
                                  alt="Rechecking..."
                                  style={{ width: '16px', height: '16px', display: 'block' }}
                                />
                              ) : (
                                <>
                                  <RotateCcw size={13} />
                                  <span>Recheck</span>
                                </>
                              )}
                            </button>

                            {/* Edit Grade Button */}
                            <button
                              onClick={() => setEditingGrade(item)}
                              className="btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                              <Edit3 size={13} />
                              <span>Edit</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* CONFIRMATION MODAL: SINGLE SUBMISSION RECHECK */}
          {confirmRecheckSub && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
              <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', borderRadius: '16px', padding: '24px', border: '1px solid rgba(99,102,241,0.3)', animation: 'scaleUp 0.2s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <RotateCcw size={22} color="var(--primary)" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700' }}>Confirm Recheck Submission</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-dim)' }}>Re-evaluate with latest Prompt & Rubric</p>
                  </div>
                </div>

                <p style={{ fontSize: '0.9rem', color: 'var(--text-bright)', lineHeight: '1.6', marginBottom: '20px' }}>
                  Are you sure you want to re-evaluate the assignment for student <strong>{confirmRecheckSub.student_name}</strong> (ID: {confirmRecheckSub.student_id})?
                  <br />
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                    The submission will be evaluated against the latest Assignment Description and Rubric criteria.
                  </span>
                </p>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button onClick={() => setConfirmRecheckSub(null)} className="btn-ghost" style={{ padding: '8px 16px', fontSize: '0.86rem' }}>
                    Cancel
                  </button>
                  <button onClick={() => handleRecheckSingle(confirmRecheckSub.submission_id)} className="btn-primary" style={{ padding: '8px 18px', fontSize: '0.86rem' }}>
                    Yes, Recheck Assignment
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CONFIRMATION MODAL: RECHECK ALL SUBMISSIONS */}
          {confirmRecheckAll && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
              <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', borderRadius: '16px', padding: '26px', border: '1px solid rgba(245,158,11,0.4)', animation: 'scaleUp 0.2s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <RotateCw size={24} color="#f59e0b" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>Recheck All Submissions?</h3>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-dim)' }}>Full Class Re-evaluation</p>
                  </div>
                </div>

                <p style={{ fontSize: '0.92rem', color: 'var(--text-bright)', lineHeight: '1.6', marginBottom: '22px' }}>
                  This action will re-evaluate <strong>all {evalGrades.length} student submissions</strong> for <em>"{currentAssignment?.title}"</em> using the latest updated Prompt and Rubric.
                  <br />
                  <span style={{ fontSize: '0.84rem', color: '#fbbf24', display: 'block', marginTop: '8px' }}>
                    All existing scores and AI reasoning will be re-computed and updated in the database.
                  </span>
                </p>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button onClick={() => setConfirmRecheckAll(false)} className="btn-ghost" style={{ padding: '8px 16px', fontSize: '0.86rem' }}>
                    Cancel
                  </button>
                  <button onClick={handleRecheckAll} className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.86rem', background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                    Confirm Recheck All
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CONFIRMATION MODAL: PUBLISH RESULTS TO STUDENTS */}
          {showPublishModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
              <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', borderRadius: '16px', padding: '26px', border: '1px solid rgba(16, 185, 129, 0.4)', animation: 'scaleUp 0.2s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Send size={24} color="#10b981" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>Publish Results to Students?</h3>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-dim)' }}>Student Portal Visibility</p>
                  </div>
                </div>

                <p style={{ fontSize: '0.92rem', color: 'var(--text-bright)', lineHeight: '1.6', marginBottom: '18px' }}>
                  You are about to publish the evaluated scores and AI reasoning for <strong>"{currentAssignment?.title}"</strong>.
                  <br />
                  <span style={{ fontSize: '0.84rem', color: 'var(--accent-cyan)', display: 'block', marginTop: '8px' }}>
                    All enrolled students will immediately be able to view their marks and AI feedback breakdown on their classwork dashboard.
                  </span>
                </p>

                <div style={{ display: 'flex', gap: '14px', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', marginBottom: '22px', fontSize: '0.84rem' }}>
                  <div><strong>Graded:</strong> <span style={{ color: '#4ade80' }}>{evalStats.graded}</span> / {evalStats.total}</div>
                  <div style={{ color: 'var(--text-dim)' }}>•</div>
                  <div><strong>Flagged:</strong> <span style={{ color: '#f87171' }}>{evalStats.flagged}</span></div>
                  <div style={{ color: 'var(--text-dim)' }}>•</div>
                  <div><strong>Pending:</strong> <span style={{ color: '#fbbf24' }}>{evalStats.pending}</span></div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button onClick={() => setShowPublishModal(false)} disabled={publishingResults} className="btn-ghost" style={{ padding: '8px 16px', fontSize: '0.86rem' }}>
                    Cancel
                  </button>
                  <button
                    onClick={() => handlePublishResults(true)}
                    disabled={publishingResults}
                    className="btn-primary"
                    style={{ padding: '8px 22px', fontSize: '0.86rem', background: 'linear-gradient(135deg, #10b981, #06b6d4)', borderColor: '#10b981', fontWeight: '700' }}
                  >
                    {publishingResults ? 'Publishing...' : 'Yes, Publish Results'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PEOPLE */}
      {activeTab === 'people' && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* Teachers / Instructors Section */}
          <div style={{ marginBottom: '36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <School size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                  Teachers & Instructors
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: '4px' }}>
                  ({teachers.length || 1})
                </span>
              </div>

              {/* Creator only: Invite Teacher button */}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setShowInviteModal(true)}
                  style={{
                    background: 'linear-gradient(135deg, #FF6A00 0%, #FF2D8D 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '7px 14px',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: 'var(--shadow-glow)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.filter = 'brightness(1.0)')}
                >
                  <UserPlus size={15} />
                  <span>Invite Teacher</span>
                </button>
              )}
            </div>

            {/* List of Teachers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(teachers.length > 0 ? teachers : [
                {
                  id: classData?.teacher_id,
                  name: classData?.teacher_name || 'Lead Instructor',
                  email: 'Primary Teacher',
                  role: 'owner',
                  is_owner: true,
                }
              ]).map((t) => (
                <div
                  key={t.id || t.email}
                  className="glass-panel"
                  style={{
                    padding: '14px 20px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {t.avatar_url ? (
                      <img
                        src={t.avatar_url}
                        alt={t.name}
                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: t.is_owner ? 'var(--primary-gradient)' : 'rgba(59, 130, 246, 0.2)',
                          color: t.is_owner ? '#ffffff' : '#3b82f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '1rem',
                          boxShadow: t.is_owner ? 'var(--shadow-glow)' : 'none',
                        }}
                      >
                        {t.name ? t.name.charAt(0).toUpperCase() : 'T'}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.98rem', color: 'var(--text-main)' }}>
                        {t.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        {t.email}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {t.is_owner ? (
                      <span className="badge badge-graded" style={{ padding: '4px 10px', fontSize: '0.76rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Shield size={11} /> Primary Creator
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '4px 10px', fontSize: '0.76rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <School size={11} /> Co-Teacher
                      </span>
                    )}

                    {/* Creator can remove other co-teachers */}
                    {isOwner && !t.is_owner && (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveMember({ type: 'teacher', member: t })}
                        title={`Remove ${t.name} as co-teacher`}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-dim)',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#ef4444';
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-dim)';
                          e.currentTarget.style.background = 'none';
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Students Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                  Enrolled Students
                </h3>
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {students.length} {students.length === 1 ? 'student' : 'students'}
              </span>
            </div>

            {students.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                No students enrolled yet. Share class code <strong style={{ color: 'var(--primary)', letterSpacing: '1px' }}>{classData?.code || '...'}</strong> with your students!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {students.map((st) => (
                  <div
                    key={st.id || st.student_id}
                    className="glass-panel"
                    style={{
                      padding: '14px 20px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {st.avatar_url ? (
                        <img
                          src={st.avatar_url}
                          alt={st.name}
                          style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'rgba(255, 106, 0, 0.12)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.9rem',
                            fontWeight: '700',
                          }}
                        >
                          {st.name ? st.name.charAt(0).toUpperCase() : 'S'}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '0.92rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{st.name}</span>
                          {st.student_id_str && (
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 6px', borderRadius: '4px' }}>
                              ID: {st.student_id_str}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                          {st.email}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="badge" style={{ background: 'rgba(255, 106, 0, 0.12)', color: 'var(--primary)', border: '1px solid var(--border-subtle)', padding: '3px 9px', fontSize: '0.75rem', fontWeight: '700' }}>
                        Student
                      </span>
                      {st.enrolled_at && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          {new Date(st.enrolled_at).toLocaleDateString()}
                        </span>
                      )}

                      {/* Creator can remove enrolled students */}
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveMember({ type: 'student', member: st })}
                          title={`Remove ${st.name} from class`}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-dim)',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#ef4444';
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-dim)';
                            e.currentTarget.style.background = 'none';
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite Teacher Modal */}
      {showInviteModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="glass-panel" style={{ maxWidth: '460px', width: '90%', padding: '28px', borderRadius: '16px', animation: 'scaleUp 0.18s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <UserPlus size={18} color="var(--primary)" />
                <span>Invite Co-Teacher</span>
              </h3>
              <button
                type="button"
                onClick={() => { setShowInviteModal(false); setInviteEmail(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendInvite}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '16px' }}>
                Enter the email address of the instructor you want to invite to collaborate on <strong style={{ color: 'var(--text-main)' }}>{classData?.name}</strong>.
              </p>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Teacher's Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="instructor@university.edu"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="form-control"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem' }}
                  autoFocus
                />
              </div>

              <div style={{ background: 'rgba(255, 106, 0, 0.08)', border: '1px solid rgba(255, 106, 0, 0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '22px', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                <strong style={{ color: 'var(--primary)' }}>Rule:</strong> An enrolled student in this class cannot be a teacher of this same class. The invited user will receive an in-app notification with Accept/Decline options, as well as an invitation email.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowInviteModal(false); setInviteEmail(''); }}
                  disabled={inviting}
                  style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '600', fontSize: '0.84rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #FF6A00 0%, #FF2D8D 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 20px',
                    fontWeight: '700',
                    fontSize: '0.84rem',
                    cursor: (inviting || !inviteEmail.trim()) ? 'not-allowed' : 'pointer',
                    opacity: (inviting || !inviteEmail.trim()) ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: 'var(--shadow-glow)',
                  }}
                >
                  {inviting ? 'Sending Invite...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Removing Member */}
      {confirmRemoveMember && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="glass-panel" style={{ maxWidth: '440px', width: '90%', padding: '28px', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.3)', animation: 'scaleUp 0.18s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                  {confirmRemoveMember.type === 'teacher' ? 'Remove Co-Teacher?' : 'Remove Student?'}
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  {classData?.name}
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '22px' }}>
              Are you sure you want to remove <strong style={{ color: 'var(--text-main)' }}>{confirmRemoveMember.member?.name}</strong> ({confirmRemoveMember.member?.email}) from this class?
              {confirmRemoveMember.type === 'student'
                ? ' They will immediately lose access to all assignments, submissions, and class materials.'
                : ' They will lose all co-instructor privileges and will no longer be able to manage this class.'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setConfirmRemoveMember(null)}
                disabled={removing}
                style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '600', fontSize: '0.84rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={removing}
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 20px',
                  fontWeight: '700',
                  fontSize: '0.84rem',
                  cursor: removing ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.35)',
                }}
              >
                {removing ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
