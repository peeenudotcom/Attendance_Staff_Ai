-- Multi-company: every staff member, attendance day and call log belongs to one company.
-- Admins only ever see their own company; a platform admin (is_platform_admin) can
-- create companies and their first admin.

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  late_after_minutes int not null default 555 check (late_after_minutes between 0 and 1439), -- IST minutes, 555 = 09:15
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table organizations enable row level security;

alter table staff add column if not exists org_id uuid references organizations(id);
alter table staff add column if not exists is_platform_admin boolean not null default false;
alter table attendance add column if not exists org_id uuid references organizations(id);
alter table call_logs add column if not exists org_id uuid references organizations(id);

-- Existing data: the owner's company, plus a separate demo company for App Review.
with tarahut as (
  insert into organizations (name) values ('TARAhut') returning id
)
update staff set org_id = (select id from tarahut) where phone <> '9000000001';

with demo as (
  insert into organizations (name) values ('Demo Company') returning id
)
update staff set org_id = (select id from demo) where phone = '9000000001';

update staff set is_platform_admin = true where phone = '9915424411';
update attendance a set org_id = s.org_id from staff s where s.id = a.staff_id and a.org_id is null;
update call_logs c set org_id = s.org_id from staff s where s.id = c.staff_id and c.org_id is null;

alter table staff alter column org_id set not null;
alter table attendance alter column org_id set not null;
alter table call_logs alter column org_id set not null;

create index if not exists staff_org_idx on staff (org_id);
create index if not exists attendance_org_date_idx on attendance (org_id, date);
