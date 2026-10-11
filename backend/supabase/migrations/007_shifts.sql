-- Shifts: a company's working hours; each person can be on one (null = the company's late time, no shift end).
create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  start_minutes smallint not null check (start_minutes between 0 and 1439),
  end_minutes smallint not null check (end_minutes between 0 and 1439),
  late_after_minutes smallint not null check (late_after_minutes between 0 and 1439),
  created_at timestamptz not null default now()
);
create index if not exists shifts_org on shifts (org_id);
alter table shifts enable row level security;
alter table staff add column if not exists shift_id uuid references shifts(id) on delete set null;

-- Fewer worked minutes than this (after check-out) makes the day a half day; null = no half days.
alter table organizations add column if not exists half_day_minutes smallint check (half_day_minutes between 60 and 720);

-- Set when an admin fills in a missed check-out.
alter table attendance add column if not exists check_out_edited_by uuid references staff(id);
