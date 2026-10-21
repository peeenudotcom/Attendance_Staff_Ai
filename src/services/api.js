const API_BASE_URL = 'https://haazri.tarahutaibuilds.com/api';

const headers = {
  'Content-Type': 'application/json',
};

export const setAuthToken = (token) => {
  if (token) headers['Authorization'] = `Bearer ${token}`;
  else delete headers['Authorization'];
};

// Called when the backend rejects the saved sign-in (expired, account removed, company paused),
// so the app returns to the sign-in screen instead of failing on every request.
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

const request = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Server returned non-JSON response`);
    }
    if (response.status === 401 && headers['Authorization'] && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/verify-otp')) {
      onUnauthorized?.();
    }
    if (!response.ok) {
      const err = new Error(data.message || 'Request failed');
      err.code = data.code; // e.g. 'face': the selfie didn't match and must be retaken
      throw err;
    }
    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error.message);
    throw error;
  }
};

export const authAPI = {
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  verifyOTP: (data) => request('/auth/verify-otp', { method: 'POST', body: JSON.stringify(data) }),
  getProfile: () => request('/auth/profile'),
  deleteAccount: () => request('/account/delete', { method: 'POST' }),
};

export const attendanceAPI = {
  checkIn: (data) => request('/attendance/check-in', { method: 'POST', body: JSON.stringify(data) }),
  checkOut: (data) => request('/attendance/check-out', { method: 'POST', body: JSON.stringify(data) }),
  getHistory: (params = '') => request(`/attendance/history?${params}`),
  getToday: () => request('/attendance/today'),
  getMonth: (month) => request(`/attendance/month${month ? `?month=${month}` : ''}`),
  // admin
  add: (data) => request('/attendance', { method: 'POST', body: JSON.stringify(data) }),
  edit: (id, data) => request(`/attendance/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id) => request(`/attendance/${id}`, { method: 'DELETE' }),
  approve: (id) => request(`/attendance/${id}/approve`, { method: 'PUT' }),
  reject: (id, reason) => request(`/attendance/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),
};

export const leaveAPI = {
  mine: () => request('/leave'),
  ask: (data) => request('/leave', { method: 'POST', body: JSON.stringify(data) }),
  cancel: (id) => request(`/leave/${id}/cancel`, { method: 'POST' }),
  company: () => request('/leave/company'),
  decide: (id, data) => request(`/leave/${id}/decide`, { method: 'POST', body: JSON.stringify(data) }),
};

export const correctionsAPI = {
  mine: () => request('/corrections'),
  ask: (data) => request('/corrections', { method: 'POST', body: JSON.stringify(data) }),
  cancel: (id) => request(`/corrections/${id}/cancel`, { method: 'POST' }),
  company: () => request('/corrections/company'),
  decide: (id, data) => request(`/corrections/${id}/decide`, { method: 'POST', body: JSON.stringify(data) }),
};

export const payslipsAPI = {
  mine: () => request('/payslips'),
  get: (month) => request(`/payslips?month=${month}`),
};

export const holidaysAPI = {
  list: () => request('/holidays'),
};

export const reportsAPI = {
  day: (date) => request(`/reports/day${date ? `?date=${date}` : ''}`),
};

export const pushAPI = {
  register: (token, platform) => request('/push/register', { method: 'POST', body: JSON.stringify({ token, platform }) }),
  unregister: (token) => request('/push/unregister', { method: 'POST', body: JSON.stringify({ token }) }),
};

export const companyAPI = {
  get: () => request('/company'),
};

export const staffAPI = {
  getAll: () => request('/staff'),
  create: (data) => request('/staff', { method: 'POST', body: JSON.stringify(data) }),
  getById: (id) => request(`/staff/${id}`),
  list: (includeInactive) => request(`/staff${includeInactive ? '?include=inactive' : ''}`),
  update: (id, data) => request(`/staff/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  invite: (id) => request(`/staff/${id}/invite`, { method: 'POST' }),
  getAttendanceReport: (id, month) => request(`/staff/${id}/attendance?month=${month}`),
};

export const callLogAPI = {
  sync: (logs) => request('/call-logs/sync', { method: 'POST', body: JSON.stringify({ logs }) }),
  getByStaff: (staffId) => request(`/call-logs/${staffId}`),
};
