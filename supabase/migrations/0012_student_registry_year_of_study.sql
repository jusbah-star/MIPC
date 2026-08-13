-- Student registry academic fields used by the Registrar workspace.
alter table public.profiles
  add column if not exists year_of_study smallint;

alter table public.profiles
  drop constraint if exists profiles_year_of_study_valid;

alter table public.profiles
  add constraint profiles_year_of_study_valid
  check (year_of_study is null or year_of_study between 1 and 8);

create index if not exists profiles_student_registry_idx
  on public.profiles(role, department_id, cohort_id, registration_number);
