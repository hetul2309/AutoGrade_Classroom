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

export async function getProfileApi() {
  return apiRequest('/auth/me');
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
