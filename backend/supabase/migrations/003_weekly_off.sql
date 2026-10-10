-- Day of the week the company is closed (0 = Sunday … 6 = Saturday); null = open every day.
alter table organizations add column if not exists weekly_off smallint default 0 check (weekly_off between 0 and 6);
