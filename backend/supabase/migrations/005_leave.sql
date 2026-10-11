-- Leave requests: staff ask in the app, an admin approves or rejects (app or dashboard).
create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  type text not null check (type in ('casual', 'sick', 'paid', 'unpaid')),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by uuid references staff(id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);
create index if not exists leave_requests_org_status on leave_requests (org_id, status);
create index if not exists leave_requests_staff_dates on leave_requests (staff_id, from_date);
alter table leave_requests enable row level security;
