/**
 * api.js
 * Centralized API helper with JWT token management and error handling.
 */

const API_BASE = '';

export function getAuthToken() {
  return localStorage.getItem('token');
}

export function getCurrentUser() {
  const userJson = localStorage.getItem('user');
  try {
    return userJson ? JSON.parse(userJson) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Set Content-Type only if not sending FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearAuthSession();
    window.dispatchEvent(new Event('auth-logout'));
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    let errorDetail = 'Request failed';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      errorDetail = await response.text() || errorDetail;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

// ── Auth APIs ──
export async function loginApi(email, password) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAuthSession(data.access_token, {
    id: data.user_id,
    name: data.name,
    email: data.email,
    role: data.role,
  });
  return data;
}

export async function registerApi(registerData) {
  const data = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(registerData),
  });
  setAuthSession(data.access_token, {
    id: data.user_id,
    name: data.name,
    email: data.email,
    role: data.role,
  });
  return data;
}

export async function googleLoginApi(credential) {
  const data = await apiRequest('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  });
  setAuthSession(data.access_token, {
    id: data.user_id,
    name: data.name,
    email: data.email,
    role: data.role,
  });
  return data;
}

export async function getProfileApi() {
  return apiRequest('/auth/me');
}

// ── Admin Portal APIs ──
export async function getAdminStatsApi() {
  return apiRequest('/admin/stats');
}

export async function getAdminUsersApi(search = '', role = 'all') {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (role && role !== 'all') params.append('role', role);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/admin/users${qs}`);
}

export async function deleteUserApi(userId) {
  return apiRequest(`/admin/users/${userId}`, {
    method: 'DELETE',
  });
}

export async function getAdminAllClassesApi() {
  return apiRequest('/admin/classes');
}

export async function getAdminAllSubmissionsApi() {
  return apiRequest('/admin/submissions');
}


// ── Assignments APIs ──
export async function getAssignmentsApi() {
  return apiRequest('/assignments');
}

export async function getAssignmentDetailsApi(id) {
  return apiRequest(`/assignments/${id}`);
}

// ── Admin APIs ──
export async function getAdminAssignmentGradesApi(assignmentId) {
  return apiRequest(`/admin/assignments/${assignmentId}/grades`);
}

export async function patchGradeApi(gradeId, patchData) {
  return apiRequest(`/admin/grades/${gradeId}`, {
    method: 'PATCH',
    body: JSON.stringify(patchData),
  });
}

export async function triggerGradingApi(assignmentId, direct = false) {
  return apiRequest(`/admin/assignments/${assignmentId}/trigger-grading?direct=${direct}`, {
    method: 'POST',
  });
}

export async function recheckAllAssignmentApi(assignmentId) {
  return apiRequest(`/admin/assignments/${assignmentId}/trigger-grading?direct=true&recheck_all=true`, {
    method: 'POST',
  });
}

export async function recheckSubmissionApi(submissionId) {
  return apiRequest(`/admin/submissions/${submissionId}/recheck`, {
    method: 'POST',
  });
}

export async function publishAssignmentResultsApi(assignmentId) {
  return apiRequest(`/admin/assignments/${assignmentId}/publish-results`, {
    method: 'POST',
  });
}

export async function unpublishAssignmentResultsApi(assignmentId) {
  return apiRequest(`/admin/assignments/${assignmentId}/unpublish-results`, {
    method: 'POST',
  });
}

export async function downloadSingleSubmissionApi(submissionId, filename = 'student_submission.ipynb') {
  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`/admin/submissions/${submissionId}/download`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to download student notebook.');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadAllSubmissionsZipApi(assignmentId, zipName = 'all_submissions.zip') {
  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`/admin/assignments/${assignmentId}/download-all`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to download submissions zip.');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function createAssignmentApi(assignmentData) {
  return apiRequest('/admin/assignments', {
    method: 'POST',
    body: JSON.stringify(assignmentData),
  });
}

// ── Student APIs ──
export async function uploadSubmissionApi(assignmentId, file) {
  const formData = new FormData();
  formData.append('assignment_id', assignmentId);
  formData.append('file', file);
  return apiRequest('/submissions/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function getMyGradesApi() {
  return apiRequest('/students/me/grades');
}

// ── Google Classroom APIs ──

export async function getClassesApi() {
  return apiRequest('/classes');
}

export async function createClassApi(classData) {
  return apiRequest('/classes', {
    method: 'POST',
    body: JSON.stringify(classData),
  });
}

export async function joinClassApi(code) {
  return apiRequest('/classes/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function getClassDetailsApi(classId) {
  return apiRequest(`/classes/${classId}`);
}

export async function getClassAssignmentsApi(classId) {
  return apiRequest(`/classes/${classId}/assignments`);
}

export async function createClassAssignmentApi(classId, formData) {
  return apiRequest(`/classes/${classId}/assignments`, {
    method: 'POST',
    body: formData, // FormData with title, description, rubric_text, max_marks, deadline, attachment
  });
}

export async function updateAssignmentApi(assignmentId, data) {
  const isFormData = data instanceof FormData;
  return apiRequest(`/assignments/${assignmentId}`, {
    method: 'PATCH',
    body: isFormData ? data : JSON.stringify(data),
  });
}

export async function getClassStudentsApi(classId) {
  return apiRequest(`/classes/${classId}/students`);
}

export function getAssignmentAttachmentUrl(assignmentId) {
  return `/assignments/${assignmentId}/attachment`;
}
