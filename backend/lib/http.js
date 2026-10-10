import { currentStaff } from './auth.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Wraps a route: method check, JSON errors in the { message } shape the app reads,
 * and (unless `public: true`) a signed-in staff member, with their company as `staff.org`,
 * passed as `ctx.staff`. `admin: true` limits a route to company admins, `platform: true`
 * to the platform admin.
 */
export function route(methods, opts = {}) {
  return async (req, res) => {
    const handler = methods[req.method];
    if (!handler) {
      res.setHeader('Allow', Object.keys(methods).join(', '));
      return res.status(405).json({ message: 'Method not allowed' });
    }
    try {
      const ctx = {};
      if (!opts.public) {
        ctx.staff = await currentStaff(req);
        if (!ctx.staff) return res.status(401).json({ message: 'Your session has expired. Please sign out and sign in again.' });
        if (opts.admin && ctx.staff.role !== 'admin') return res.status(403).json({ message: 'Only admins can do this' });
        if (opts.platform && !ctx.staff.is_platform_admin) return res.status(403).json({ message: 'Only the platform admin can do this' });
      }
      const result = await handler(req, ctx);
      return res.status(200).json(result ?? {});
    } catch (err) {
      if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
      console.error(`[${req.method} ${req.url}]`, err);
      return res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
  };
}

export function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body || '{}');
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

/** Last 10 digits of a phone number, or null if it has fewer. */
export function cleanPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}
