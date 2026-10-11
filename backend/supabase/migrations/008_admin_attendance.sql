-- Attendance added or corrected by an admin (no selfie or location): who set the check-in, and an optional note.
alter table attendance add column if not exists check_in_edited_by uuid references staff(id);
alter table attendance add column if not exists admin_note text;
