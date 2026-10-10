-- TARAhut Attendance backend schema.
-- Every table has row level security on and no policies: only the backend,
-- which uses the service-role key, can read or write. The app never talks to
-- Supabase directly.

create extension if not exists pgcrypto;

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,          -- last 10 digits, e.g. 9915424411
  email text,                          -- where sign-in codes are sent
  role text not null default 'staff' check (role in ('admin', 'staff')),
  department text,
  designation text,
  salary_type text check (salary_type in ('monthly', 'daily', 'hourly', 'weekly')),
  salary numeric,
  active boolean not null default true,
  created_by uuid references staff(id),
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- One active sign-in code per phone, stored hashed.
create table if not exists otp_codes (
  phone text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,     -- wrong guesses against the current code
  sends int not null default 0,        -- codes sent in the current window
  window_started_at timestamptz not null default now()
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  date date not null,                  -- IST calendar day
  status text not null default 'present' check (status in ('present', 'late')),
  check_in_at timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,
  check_in_address text,
  check_in_selfie text,                -- path in the private "selfies" bucket
  check_out_at timestamptz,
  check_out_lat double precision,
  check_out_lng double precision,
  check_out_address text,
  check_out_selfie text,
  worked_minutes int,
  approval text not null default 'pending' check (approval in ('pending', 'approved', 'rejected')),
  reject_reason text,
  reviewed_by uuid references staff(id),
  created_at timestamptz not null default now(),
  unique (staff_id, date)
);
create index if not exists attendance_date_idx on attendance (date);

create table if not exists call_logs (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  number text not null,
  contact_name text,
  type text,
  duration_seconds int,
  called_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (staff_id, number, called_at)
);

alter table staff enable row level security;
alter table otp_codes enable row level security;
alter table attendance enable row level security;
alter table call_logs enable row level security;

-- Private bucket for check-in/out selfies (served only through short-lived signed URLs).
insert into storage.buckets (id, name, public)
values ('selfies', 'selfies', false)
on conflict (id) do nothing;
