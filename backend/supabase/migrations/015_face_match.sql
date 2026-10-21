-- Face match: when a company turns it on, each check-in selfie is compared with the person's reference photo
-- (their first check-in selfie after it was turned on, or after an admin resets it), using Amazon Rekognition.
-- The result is shown to admins; check-in is never blocked by it.
alter table organizations add column if not exists face_match boolean not null default false;
alter table staff add column if not exists face_ref text;            -- storage path of the reference photo (selfies bucket)
alter table staff add column if not exists face_ref_at timestamptz;
alter table attendance add column if not exists check_in_face text check (check_in_face in ('match', 'mismatch', 'no_face', 'enrolled', 'error'));
alter table attendance add column if not exists check_in_face_score numeric;
