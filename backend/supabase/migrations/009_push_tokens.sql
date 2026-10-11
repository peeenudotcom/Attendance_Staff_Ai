-- Expo push tokens: one row per phone, linked to whoever last signed in on it.
create table if not exists push_tokens (
  token text primary key,
  staff_id uuid not null references staff(id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_staff on push_tokens (staff_id);
alter table push_tokens enable row level security;
