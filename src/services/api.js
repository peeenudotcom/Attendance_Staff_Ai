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
    if (!response.ok) throw new Error(data.message || 'Request failed');
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
};

export const attendanceAPI = {
  checkIn: (data) => request('/attendance/check-in', { method: 'POST', body: JSON.stringify(data) }),
  checkOut: (data) => request('/attendance/check-out', { method: 'POST', body: JSON.stringify(data) }),
  getHistory: (params = '') => request(`/attendance/history?${params}`),
  getToday: () => request('/attendance/today'),
  approve: (id) => request(`/attendance/${id}/approve`, { method: 'PUT' }),
  reject: (id, reason) => request(`/attendance/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),
};

export const staffAPI = {
  getAll: () => request('/staff'),
  create: (data) => request('/staff', { method: 'POST', body: JSON.stringify(data) }),
  getById: (id) => request(`/staff/${id}`),
  getAttendanceReport: (id, month) => request(`/staff/${id}/attendance?month=${month}`),
};

export const callLogAPI = {
  sync: (logs) => request('/call-logs/sync', { method: 'POST', body: JSON.stringify({ logs }) }),
  getByStaff: (staffId) => request(`/call-logs/${staffId}`),
};
