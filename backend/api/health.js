import { route } from '../lib/http.js';

// GET /api/health -> confirms the deployment is up (no database call)
export default route({ GET: () => ({ ok: true }) }, { public: true });
