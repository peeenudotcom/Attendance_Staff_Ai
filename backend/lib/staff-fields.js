import { cleanPhone, HttpError } from './http.js';
import { emailProblem } from './email-check.js';

export const SALARY_TYPES = ['monthly', 'daily', 'hourly', 'weekly'];
export const text = (v, max = 120) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));

/**
 * Validates staff fields from a request body. With `partial`, only fields present in the
 * body are checked and returned (for edits); otherwise name, phone and email are required.
 * Returns a patch in database column names.
 */
export function staffFields(b, { partial = false } = {}) {
  const out = {};
  const has = (k) => b[k] !== undefined;

  if (!partial || has('name')) {
    const name = text(b.name);
    if (!name) throw new HttpError(400, 'Name is required');
    out.name = name;
  }
  if (!partial || has('phone')) {
    const phone = cleanPhone(b.phone);
    if (!phone) throw new HttpError(400, 'Enter a valid 10-digit phone number');
    out.phone = phone;
  }
  if (!partial || has('email')) {
    const email = text(b.email, 200)?.toLowerCase() ?? null;
    const problem = emailProblem(email);
    if (problem) throw new HttpError(400, problem);
    out.email = email;
  }
  if (has('department')) out.department = text(b.department);
  if (has('designation')) out.designation = text(b.designation);
  if (has('salaryType')) out.salary_type = SALARY_TYPES.includes(b.salaryType) ? b.salaryType : null;
  if (has('salary')) {
    const salary = b.salary === '' || b.salary == null ? null : Number(b.salary);
    if (salary != null && (!Number.isFinite(salary) || salary < 0)) throw new HttpError(400, 'Enter a valid salary amount');
    out.salary = salary;
  }
  if (has('role')) out.role = b.role === 'admin' ? 'admin' : 'staff';
  return out;
}

/** Staff as admins see them (adds status and pay fields to the public user). */
export function adminView(s) {
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    role: s.role,
    department: s.department,
    designation: s.designation,
    salaryType: s.salary_type,
    salary: s.salary,
    active: s.active,
    lastLoginAt: s.last_login_at,
    createdAt: s.created_at,
  };
}
