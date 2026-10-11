-- Salary: every N late marks in a month cut half a day's pay (null = no cut).
alter table organizations add column if not exists late_cut_every smallint check (late_cut_every between 2 and 10);
