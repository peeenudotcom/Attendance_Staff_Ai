-- Overtime: minutes worked in a day beyond the person's shift length (or overtime_after_minutes when they have no
-- shift) are paid at overtime_rate × their hourly rate. Null rate = overtime is shown but not paid.
alter table organizations add column if not exists overtime_rate numeric check (overtime_rate between 1 and 3);
alter table organizations add column if not exists overtime_after_minutes smallint check (overtime_after_minutes between 240 and 960);

-- Paid leave balance: days a year each person earns (1/12 each month, from January or their joining month,
-- reset every January). Casual, sick and paid leave use it; unpaid leave doesn't. Null = no limit.
alter table organizations add column if not exists paid_leave_per_year smallint check (paid_leave_per_year between 0 and 60);

-- A WhatsApp message to the company's admins every morning with who has checked in.
alter table organizations add column if not exists daily_summary boolean not null default false;
