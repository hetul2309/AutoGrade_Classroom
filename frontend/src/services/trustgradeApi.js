/**
 * trustgradeApi.js
 * Frontend API service for TrustGrade security badges and explainability insights.
 */

import { apiRequest } from '../api';

export async function getTrustgradeStatusApi() {
  return apiRequest('/trustgrade/status').catch(() => ({ enabled: false }));
}
