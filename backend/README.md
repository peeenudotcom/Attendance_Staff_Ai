# TARAhut Haazri backend

Vercel functions (`api/`) + Supabase (Postgres and a private `selfies` bucket). Every route the app calls lives
here; the app's base URL is `https://<deployment>/api`.

| Route | Who | What |
| --- | --- | --- |
| `POST /api/auth/login` `{ phone }` | anyone | emails a 4-digit code (5 min, 5 tries, 5 codes per 15 min) |
| `POST /api/auth/verify-otp` `{ phone, otp }` | anyone | `{ user, token }` (token valid 30 days) |
| `GET /api/auth/profile` | signed in | the current user |
| `POST /api/attendance/check-in`, `check-out` | signed in | `{ selfie (base64 JPEG), latitude, longitude, accuracy?, address, timestamp }`; check-in refused outside the office radius when location lock is on |
| `GET /api/attendance/today`, `history?month=YYYY-MM` | signed in | own records |
| `GET /api/staff`, `POST /api/staff` | admin | list with today's status; add a staff member (name, phone, email required) |
| `GET /api/staff?include=inactive` | admin | also lists switched-off staff |
| `GET /api/staff/:id`, `/api/staff/:id/attendance?month=` | admin | detail; month with selfie links |
| `PATCH /api/staff/:id` `{ name?, phone?, email?, designation?, department?, role?, active? }` | admin | edit or switch off (can't remove the last admin or yourself) |
| `POST /api/staff/:id/invite` | admin | resend the welcome email |
| `GET /api/reports/day?date=YYYY-MM-DD` | admin | everyone's day: status, times, place, selfie links |
| `GET /api/reports/month?month=YYYY-MM` | admin | attendance sheet with totals |
| `PUT /api/attendance/:id/approve`, `/reject` `{ reason }` | admin | review a day |
| `POST /api/call-logs/sync` `{ logs }` | signed in | Android call history |
| `GET /api/company`, `PATCH /api/company` `{ name?, lateAfterMinutes?, weeklyOff?, office? }` | signed in / company admin | own company and its settings |
| `GET /api/companies`, `POST /api/companies` `{ name, adminName, adminPhone, adminEmail }` | platform admin | client companies; add one with its first admin |
| `PATCH /api/companies/:id` `{ name?, logoUrl?, lateAfterMinutes?, active? }` | platform admin | edit or pause a company |
| `GET /api/leave`, `POST /api/leave` `{ from, to, type, reason? }` | signed in | own leave requests; ask for leave (admins are emailed) |
| `POST /api/leave/:id/cancel` | signed in | withdraw your own pending request, or approved leave that hasn't started |
| `GET /api/leave/company` | admin | `{ pending, recent }` for the company |
| `POST /api/leave/:id/decide` `{ approve, note? }` | admin | approve or reject (the person is emailed) |
| `GET /api/health` | anyone | `{ ok: true }` |
| `/privacy`, `/support`, `/get` | anyone | pages for the App Store listing; install page |
| `/dashboard` | company admins | owner web dashboard (see below) |

## Environment (Vercel project `tarahut-attendance`)

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | `https://oilkvoexlvhkjthpvgfr.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project settings → API keys → `service_role` (secret) |
| `AUTH_TOKEN_SECRET` | random, 32+ characters; changing it signs everyone out |
| `RESEND_API_KEY`, `EMAIL_FROM` | key from the Haazri Resend account (sending access, domain-limited); sender `TARAhut Haazri <codes@haazri.tarahutaibuilds.com>` |
| `EMAIL_REPLY_TO` | `support@tarahutaibuilds.com`, where replies to code emails go |
| `REVIEW_PHONE`, `REVIEW_CODE` | App Review account; unset both to disable it |

## Email

Sign-in codes are sent by a Resend account used only for Haazri, from the subdomain
`haazri.tarahutaibuilds.com` (its DKIM/SPF records live in the tarahutaibuilds.com DNS on Vercel).
A subdomain is used on purpose: Microsoft 365 hosts mail for tarahutaibuilds.com and rejects outside
mail claiming to be from its own domain, so codes sent from `@tarahutaibuilds.com` to
`support@tarahutaibuilds.com` bounced. The sender has no mailbox; `EMAIL_REPLY_TO` sends replies to the
support shared mailbox. Free plan: 100 emails/day; each person signs in about once a month.

DNS: `haazri.tarahutaibuilds.com` has its own CNAME to `cname.vercel-dns.com`. It must stay: once
Resend's records exist under `haazri.*`, the domain's `*` wildcard no longer covers `haazri` itself, and
without the CNAME the app's API address stops resolving ("Network request failed" in the app).

## Companies

Every staff member, attendance day and call log belongs to one company (`organizations`); every
query is limited to the caller's company. Company admins (`role = 'admin'`) manage their own staff and
settings; the platform admin (`staff.is_platform_admin`, the owner) creates and pauses client companies.
A phone number belongs to one person in one company.

## Dashboard

`public/dashboard/` is a plain HTML/JS page (no build step) at `/dashboard`, using the same `/api` and sign-in
codes as the app. Only `role = 'admin'` can use it. Tabs: Today (status, times, place, selfies), Monthly sheet
(with a CSV download that opens in Excel), Staff (add, edit, switch off, resend invite), Settings (name, late
time, weekly off) and, for the platform admin, Clients (add, pause or resume companies).

The weekly off day is a single company setting, so changing it also changes how past months show.

## Leave

Staff ask for leave in the app (Leave on the home screen): casual, sick, paid or unpaid, from up to 30 days back, at
most 60 days per request, no overlap with their own pending or approved leave. Admins approve or reject in the app or
on the dashboard's Leave tab (which shows a count of waiting requests), and can change a decision later. Approved leave
shows as "On leave" on Today and "LV" on the monthly sheet and its download; a check-in on a leave day still counts as
present, and the weekly off stays "off". Day counts leave out the weekly off.

## Location lock

A company admin sets an office location and an allowed distance (Settings in the dashboard; `office: { lat, lng, radiusM }`
on `PATCH /api/company`, `null` turns it off). Check-in from farther away is refused with the distance in the message;
the phone's reported GPS accuracy gives up to 50 m of extra room. Check-out is never blocked. Staff marked "can check
in from anywhere" (`locationFree`) skip the check. Every check-in and check-out stores its distance from the office,
shown on the dashboard's Today page. The app warns before the selfie (`lockApplies` on `GET /api/company`); the server
decides. A fake-GPS app on a rooted Android phone can still get around it; the selfie and the map link are the backstop.

## Database

`supabase/migrations/` (001 to 005 applied). Row level security is on with no policies, so only the
service-role key used here can read or write; the app never talks to Supabase directly.

Add or change people directly when needed:

```sql
update staff set email = 'someone@example.com' where phone = '9915424411';
update staff set active = false where phone = '9876543210';   -- blocks sign-in
```

## Tests

`npm install && npm test` runs every route against an in-memory stand-in for Supabase.
