-- Keep registration numbers mandatory for students only.
alter table public.profiles alter column registration_number drop not null;
