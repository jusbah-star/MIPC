-- Registration-number based student passwordless campus portal access.
-- Registration numbers are institution-managed student identifiers and are never exposed publicly.

alter table profiles
  add column if not exists registration_number text;

-- Give existing student accounts a stable temporary institutional identifier so no
-- student becomes inaccessible after this migration. Administrators may replace
-- these with the college's official registration numbers later.
with numbered as (
  select id, row_number() over (order by created_at, id) as seq
  from profiles
  where role = 'student' and registration_number is null
)
update profiles p
set registration_number = 'MIPC-' || to_char(current_date, 'YYYY') || '-' || lpad(numbered.seq::text, 5, '0')
from numbered
where p.id = numbered.id;

create unique index if not exists profiles_registration_number_unique
  on profiles (upper(registration_number))
  where registration_number is not null;

alter table profiles
  drop constraint if exists profiles_registration_number_format;

alter table profiles
  add constraint profiles_registration_number_format
  check (registration_number is null or char_length(registration_number) between 4 and 40);

alter table profiles
  drop constraint if exists profiles_student_registration_number_required;

alter table profiles
  add constraint profiles_student_registration_number_required
  check (role <> 'student' or (registration_number is not null and btrim(registration_number) <> ''));

comment on column profiles.registration_number is
  'Institution-issued student registration identifier used with email for passwordless portal sign-in.';
