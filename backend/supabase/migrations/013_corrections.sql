-- Staff correction requests: "I forgot to check in / out" or "the time is wrong", with the right time and a reason.
-- An admin approves (the attendance is then added or fixed, marked as edited by that admin) or rejects it.
create table if not exists correction_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('missed_check_in', 'missed_check_out', 'wrong_time')),
  check_in text check (check_in ~ '^\d{2}:\d{2}$'),
  check_out text check (check_out ~ '^\d{2}:\d{2}$'),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decision_note text,
  decided_by uuid references staff(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists correction_requests_org_idx on correction_requests (org_id, status);
create unique index if not exists correction_requests_one_pending on correction_requests (staff_id, date) where status = 'pending';
alter table correction_requests enable row level security;

-- The day someone was switched off (or deleted their account). They stay on that month's sheet and salary,
-- paid up to this day; switching them back on clears it.
alter table staff add column if not exists left_on date;
