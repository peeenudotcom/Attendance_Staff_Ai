-- Store-review demo accounts (run once in the Supabase SQL editor, then set REVIEW_PHONE in Vercel to
-- "9000000001,9000000002"). Both numbers sign in with REVIEW_CODE; no email is sent.
--   9000000001  staff  (already exists: "App Review" in Demo Company)
--   9000000002  admin  (added here, so reviewers can see Team today, leave approvals and the staff list)
-- The extra people are fictional so the admin screens aren't empty. Nothing here touches a real company.

insert into staff (org_id, name, phone, role, designation, department, active)
select o.id, v.name, v.phone, v.role, v.designation, v.department, true
from organizations o
cross join (values
  ('Demo Admin',  '9000000002', 'admin', 'Manager',         'Management'),
  ('Aarav Mehta', '9000000011', 'staff', 'Accountant',      'Accounts'),
  ('Neha Sharma', '9000000012', 'staff', 'Front Desk',      'Admin'),
  ('Aman Gill',   '9000000013', 'staff', 'Store Keeper',    'Stores')
) as v(name, phone, role, designation, department)
where o.name = 'Demo Company'
on conflict (phone) do nothing;

-- Demo Company must stay without a location lock, so reviewers anywhere in the world can check in:
update organizations set office_lat = null, office_lng = null, office_radius_m = null where name = 'Demo Company';
