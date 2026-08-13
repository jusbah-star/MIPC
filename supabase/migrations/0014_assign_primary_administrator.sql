-- Assign the designated MIPC administrator account.
-- Authorization remains profile-based and server-side; the login tab itself grants no role.

update public.profiles
set
  role = 'admin'::public.user_role,
  account_status = 'active'
where lower(email) = lower('thetesemuragije@gmail.com');
