-- Keep registration numbers mandatory for students only.
alter table public.profiles alter column registration_number drop not null;

alter table public.profiles
  drop constraint if exists profiles_student_registration_number_required;
