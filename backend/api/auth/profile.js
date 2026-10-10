import { route } from '../../lib/http.js';
import { publicUser } from '../../lib/auth.js';

// GET /api/auth/profile (Bearer) -> the signed-in staff member
export default route({
  GET: (req, { staff }) => publicUser(staff),
});
