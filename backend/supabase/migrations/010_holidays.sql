-- Company holidays: paid days off for everyone (not absent; weekly-off rules apply to salary).
create table if not exists holidays (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  date date not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (org_id, date)
);
alter table holidays enable row level security;
