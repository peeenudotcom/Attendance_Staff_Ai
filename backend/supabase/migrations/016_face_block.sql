-- Face match blocks a selfie that doesn't match: the person retakes it. After 3 failed tries in a row the attempt goes
-- through, flagged for the admin. face_fails counts the tries in a row (reset after a match or 30 minutes).
-- Check-out selfies are compared too.
alter table staff add column if not exists face_fails integer not null default 0;
alter table staff add column if not exists face_fails_at timestamptz;
alter table attendance add column if not exists check_out_face text check (check_out_face in ('match', 'mismatch', 'no_face', 'enrolled', 'error'));
alter table attendance add column if not exists check_out_face_score numeric;
