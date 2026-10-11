-- Location lock: a company's office and how close staff must be to check in (null radius = off).
alter table organizations add column if not exists office_lat double precision;
alter table organizations add column if not exists office_lng double precision;
alter table organizations add column if not exists office_radius_m integer check (office_radius_m between 25 and 5000);

-- Field staff who may check in from anywhere.
alter table staff add column if not exists location_free boolean not null default false;

-- How far from the office each check-in and check-out was (metres; null when no office is set).
alter table attendance add column if not exists check_in_distance_m integer;
alter table attendance add column if not exists check_out_distance_m integer;
