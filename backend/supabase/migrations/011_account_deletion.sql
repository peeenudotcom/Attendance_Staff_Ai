-- Account deletion (Google Play / App Store requirement): a person can delete their own account from the app.
-- The account is switched off at once; personal data is erased 30 days later by the daily erase job.
alter table staff add column if not exists deletion_requested_at timestamptz;
alter table staff add column if not exists erased_at timestamptz;
create index if not exists staff_deletion_idx on staff (deletion_requested_at) where erased_at is null;
