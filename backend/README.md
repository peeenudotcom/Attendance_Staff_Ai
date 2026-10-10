# TARAhut Attendance backend

Vercel functions (`api/`) + Supabase (Postgres and a private `selfies` bucket). Every route the app calls lives
here; the app's base URL is `https://<deployment>/api`.

| Route | Who | What |
| --- | --- | --- |
| `POST /api/auth/login` `{ phone }` | anyone | emails a 4-digit code (5 min, 5 tries, 5 codes per 15 min) |
| `POST /api/auth/verify-otp` `{ phone, otp }` | anyone | `{ user, token }` (token valid 30 days) |
| `GET /api/auth/profile` | signed in | the current user |
| `POST /api/attendance/check-in`, `check-out` | signed in | `{ selfie (base64 JPEG), latitude, longitude, address, timestamp }` |
| `GET /api/attendance/today`, `history?month=YYYY-MM` | signed in | own records |
| `GET /api/staff`, `POST /api/staff` | admin | list with today's status; add a staff member (name, phone, email required) |
| `GET /api/staff/:id`, `/api/staff/:id/attendance?month=` | admin | detail; month with selfie links |
| `PUT /api/attendance/:id/approve`, `/reject` `{ reason }` | admin | review a day |
| `POST /api/call-logs/sync` `{ logs }` | signed in | Android call history |
| `GET /api/health` | anyone | `{ ok: true }` |
| `/privacy`, `/support` | anyone | pages for the App Store listing |

## Environment (Vercel project `tarahut-attendance`)

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | `https://oilkvoexlvhkjthpvgfr.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project settings → API keys → `service_role` (secret) |
| `AUTH_TOKEN_SECRET` | random, 32+ characters; changing it signs everyone out |
| `RESEND_API_KEY`, `EMAIL_FROM` | same values as the CRM (sender must be a domain verified in Resend) |
| `REVIEW_PHONE`, `REVIEW_CODE` | App Review account; unset both to disable it |
| `LATE_AFTER_MINUTES_IST` | optional, default 555 (09:15 IST) |

## Database

`supabase/migrations/001_init.sql` (already applied). Row level security is on with no policies, so only the
service-role key used here can read or write; the app never talks to Supabase directly.

Add or change people directly when needed:

```sql
update staff set email = 'someone@example.com' where phone = '9915424411';
update staff set active = false where phone = '9876543210';   -- blocks sign-in
```

## Tests

`npm install && npm test` runs every route against an in-memory stand-in for Supabase.
