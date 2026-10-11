-- Salary advances and adjustments, and closing (locking) a month.
-- Adjustments are entered per person per month: advance (subtracted), bonus (added), deduction (subtracted),
-- addition (added). Closing a month saves the whole salary sheet as it stood (snapshot), so later changes to
-- salary, shift, weekly off or holidays can't alter it; attendance, leave, holidays and adjustments in a closed
-- month can't be changed until it is reopened (with a reason). Every close and reopen is logged.
create table if not exists pay_adjustments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  kind text not null check (kind in ('advance', 'bonus', 'deduction', 'addition')),
  amount numeric not null check (amount > 0),
  note text,
  created_by uuid references staff(id),
  created_at timestamptz not null default now()
);
create index if not exists pay_adjustments_month_idx on pay_adjustments (org_id, month);

create table if not exists month_closes (
  org_id uuid not null references organizations(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  closed boolean not null default true,
  snapshot jsonb,
  closed_by uuid references staff(id),
  closed_at timestamptz,
  primary key (org_id, month)
);

create table if not exists month_close_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  month text not null,
  action text not null check (action in ('closed', 'reopened')),
  reason text,
  by_staff uuid references staff(id),
  by_name text,
  at timestamptz not null default now()
);
create index if not exists month_close_log_idx on month_close_log (org_id, month);

alter table pay_adjustments enable row level security;
alter table month_closes enable row level security;
alter table month_close_log enable row level security;
