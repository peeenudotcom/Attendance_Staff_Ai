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
| `GET /api/attendance/month?month=YYYY-MM` | signed in | own month for the app's calendar: each day's status and times, with totals |
| `POST /api/push/register` `{ token, platform }`, `POST /api/push/unregister` `{ token }` | signed in | link or unlink this phone for push notifications |
| `GET /api/staff`, `POST /api/staff` | admin | list with today's status; add a staff member (name, phone, email required) |
| `GET /api/staff?include=inactive` | admin | also lists switched-off staff |
| `GET /api/staff/:id`, `/api/staff/:id/attendance?month=` | admin | detail; month with selfie links |
| `PATCH /api/staff/:id` `{ name?, phone?, email?, designation?, department?, role?, active? }` | admin | edit or switch off (can't remove the last admin or yourself) |
| `POST /api/staff/:id/invite` | admin | resend the welcome email |
| `GET /api/reports/day?date=YYYY-MM-DD` | admin | everyone's day: status, times, place, selfie links |
| `GET /api/reports/month?month=YYYY-MM` | admin | attendance sheet with totals |
| `PUT /api/attendance/:id/approve`, `/reject` `{ reason }` | admin | review a day |
| `POST /api/call-logs/sync` `{ logs }` | signed in | Android call history |
| `GET /api/company`, `PATCH /api/company` `{ name?, lateAfterMinutes?, weeklyOff?, office?, lateCutEvery?, halfDayMinutes? }` | signed in / company admin | own company and its settings |
| `GET /api/companies`, `POST /api/companies` `{ name, adminName, adminPhone, adminEmail }` | platform admin | client companies; add one with its first admin |
| `PATCH /api/companies/:id` `{ name?, logoUrl?, lateAfterMinutes?, active? }` | platform admin | edit or pause a company |
| `GET /api/leave`, `POST /api/leave` `{ from, to, type, reason? }` | signed in | own leave requests; ask for leave (admins are emailed) |
| `POST /api/leave/:id/cancel` | signed in | withdraw your own pending request, or approved leave that hasn't started |
| `GET /api/leave/company` | admin | `{ pending, recent }` for the company |
| `POST /api/leave/:id/decide` `{ approve, note? }` | admin | approve or reject (the person is emailed) |
| `GET /api/reports/salary?month=YYYY-MM` | admin | each person's pay for the month from attendance (pay so far for the current month) |
| `GET /api/shifts`, `POST /api/shifts` `{ name, start, end, lateAfter? }` | admin | the company's shifts; add one |
| `PATCH /api/shifts/:id`, `DELETE /api/shifts/:id` | admin | edit; delete (people on it go back to the company late time) |
| `POST /api/attendance` `{ staffId, date, checkIn, checkOut?, note? }` | admin | add a day for someone who couldn't check in |
| `PATCH /api/attendance/:id` `{ checkIn?, checkOut?, note? }` | admin | fill in a missed check-out or correct the times (hours and late mark worked out again) |
| `DELETE /api/attendance/:id` | admin | remove a day recorded by mistake |
| `GET /api/holidays?year=` | signed in | the company's holidays (default this year and next) |
| `POST /api/holidays` `{ date, name }`, `DELETE /api/holidays/:id` | admin | add or remove a holiday |
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
| `REVIEW_PHONE`, `REVIEW_CODE` | App Review accounts (one number or several, comma-separated, e.g. `9000000001,9000000002`) that sign in with the fixed code; unset both to disable |
| `CRON_SECRET` | Any long random string; lets Vercel Cron run the daily erase job for deleted accounts (`/api/cron/erase-accounts`) |

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

## Salary

Each person's pay type (monthly, weekly, daily, hourly) and amount are set on their Staff record. The dashboard's
Salary tab (and `lib/payroll.js`) works out pay for a month:

- monthly: salary ÷ days in the month × paid days (worked, weekly off, approved casual/sick/paid leave)
- weekly: the same at salary ÷ 7 a day
- daily: rate × days worked
- hourly: rate × hours between check-in and check-out

Absent days and unpaid leave are not paid. A company can set "every N late marks = half-day cut" (not for hourly pay).
Only days up to today count, so the current month shows pay so far. It's a calculation from attendance, not a payslip:
no PF, ESI, TDS, advances or bonuses.

## Shifts and half days

A company can define shifts (name, start, end, late-after time; an end before the start is an overnight shift) and put
each person on one in Staff; anyone without a shift uses the company's late time. Late marks follow the person's shift,
measured from its start (so 00:30 on a 22:00 shift is late; arriving up to 6 hours early is on time). Today shows the
shift and "Left N min early" when someone checks out more than 5 minutes before it ends.

Night shifts: until 20 hours after a check-in with no check-out, the app treats that record as current, so checking out
after midnight closes yesterday's shift, and a new check-in is refused until it's closed.

Half days: with "less than N hours worked = half day" set, a checked-out day under N hours is a half day ("H" on the
sheet, half pay). Missed check-outs show as "No check-out" on past days; an admin can set the out time on Today.

## Attendance corrections

Staff ask for a correction in the app (Corrections, a day in My attendance, or straight from a failed check-in):
*forgot to check out*, *could not check in* or *wrong time*, with the right time(s) and a reason, for the last 45 days
(`POST /api/corrections`; one waiting request per day; `POST /api/corrections/:id/cancel` withdraws it). Admins are
emailed and notified; they approve or reject in the app or on the dashboard's Requests page
(`GET /api/corrections/company`, `POST /api/corrections/:id/decide`). Approving adds or fixes the day like an admin edit
(times given replace the recorded ones, hours and late mark worked out again from the shift, note "Correction: reason");
decisions are final. Waiting corrections are listed in the month-close check, and a closed month refuses them.

## Staff who leave

Switching someone off records the day (`staff.left_on`; deleting an account does too, switching back on clears it).
They stay on that month's sheet and salary, paid up to that day; later days show as *left*, not absent.

## Month close, advances and adjustments

Admins record an **advance** already paid, a **bonus**, a **deduction** or an **other addition** against a person's
month (`POST /api/pay-adjustments`, `DELETE /api/pay-adjustments/:id`). The salary sheet shows *earned from attendance*,
*adjustments* and *balance payable* (= earned + bonuses/additions − advances/deductions) per person (`lib/month-close.js`).

After a month ends it can be **closed** (`GET /api/month-close?month=` lists missing check-outs, leave still waiting and
people with no pay; `POST /api/month-close`). Closing saves the whole salary sheet as a snapshot in `month_closes`, so
later changes to salary, shift, weekly off or holidays can't alter it, and blocks changes to that month's attendance,
leave decisions, holidays and adjustments (409 "… is closed"). **Reopen** (`POST /api/month-close/reopen`) needs a reason;
every close and reopen is kept in `month_close_log` and shown as the month's history on the Salary page.

## Holidays

Admins add company holidays in Settings (with quick-add for 26 Jan, 15 Aug, 2 Oct and 25 Dec; festivals that move
each year are entered by hand). A holiday shows as "Holiday" (HO on the sheet), is paid like the weekly off for monthly
and weekly salaries (daily and hourly pay only days worked), isn't counted as a leave day, and gets no check-in
reminder. Checking in on a holiday still counts as a worked day; the weekly off wins if both fall on the same day.

## Notifications

The app registers an Expo push token for the signed-in person (`push_tokens`, one row per phone). The server pushes
"Leave request" to a company's admins and "Leave approved / not approved" to the person (`lib/push.js`; failures never
fail the request, and tokens Expo reports as gone are removed). Check-in and check-out reminders are scheduled on the
phone itself from the person's shift (or the company late time), skipping the weekly off and approved leave; they can
be turned off in Profile.

## Admin-added attendance

Admins can add a day for someone who couldn't check in (Today's "Add attendance", or click a day on the monthly sheet),
correct the in/out times, or remove a day. These days have no selfie or location; they're marked "Added by admin"
(with an optional note) on Today and with a dashed outline on the sheet. Late or on time follows the person's shift.
Times must not be in the future; a check-out not after the check-in is on the next day (night shift), at most 20 hours later.

## Location lock

A company admin sets an office location and an allowed distance (Settings in the dashboard; `office: { lat, lng, radiusM }`
on `PATCH /api/company`, `null` turns it off). Check-in from farther away is refused with the distance in the message;
the phone's reported GPS accuracy gives up to 50 m of extra room. Check-out is never blocked. Staff marked "can check
in from anywhere" (`locationFree`) skip the check. Every check-in and check-out stores its distance from the office,
shown on the dashboard's Today page. The app warns before the selfie (`lockApplies` on `GET /api/company`); the server
decides. A fake-GPS app on a rooted Android phone can still get around it; the selfie and the map link are the backstop.

## Account deletion

Anyone can delete their own account (app: You → Delete my account; `POST /api/account/delete`; web instructions at
`/delete-account`). The account is switched off at once (no sign-in, notification tokens removed) and TARAhut support
plus the company's admins are emailed; the person gets a confirmation email. A deleted account can't be switched back on.
30 days later the daily job (`/api/cron/erase-accounts`, Vercel Cron, needs `CRON_SECRET`) erases it (`lib/account-deletion.js`):
selfie files, check-in locations and addresses, leave reasons, call logs and codes go; the staff row becomes "Deleted user"
with no phone or email, and the attendance days and hours stay for the employer's payroll. The review demo accounts are
never switched off. To erase someone sooner, set their `deletion_requested_at` back by 30 days and wait for the next run.

## Database

`supabase/migrations/` (001 to 011 applied; 012 month close and 013 corrections to apply). Row level security is on with no policies, so only the
service-role key used here can read or write; the app never talks to Supabase directly.

Add or change people directly when needed:

```sql
update staff set email = 'someone@example.com' where phone = '9915424411';
update staff set active = false where phone = '9876543210';   -- blocks sign-in
```

## Tests

`npm install && npm test` runs every route against an in-memory stand-in for Supabase.
