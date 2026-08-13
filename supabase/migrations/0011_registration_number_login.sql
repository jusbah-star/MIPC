-- Registration-number based passwordless campus portal access.
-- Registration numbers are institution-managed identifiers and are never exposed publicly.

alter table profiles
  add column if not exists registration_number text;

-- Give existing accounts a stable temporary institutional identifier so no
-- account becomes inaccessible after this migration. Administrators may
-- replace these with the college's official registration numbers later.
with numbered as (
  select id, row_number() over (order by created_at, id) as seq
  from profiles
  where registration_number is null
)
update profiles p
set registration_number = 'MIPC-' || to_char(current_date, 'YYYY') || '-' || lpad(numbered.seq::text, 5, '0')
from numbered
where p.id = numbered.id;

alter table profiles
  alter column registration_number set not null;

create unique index if not exists profiles_registration_number_unique
  on profiles (upper(registration_number));

alter table profiles
  add constraint profiles_registration_number_format
  check (char_length(registration_number) between 4 and 40);

comment on column profiles.registration_number is
  'Institution-issued student/staff registration identifier used with email for passwordless portal sign-in.';
