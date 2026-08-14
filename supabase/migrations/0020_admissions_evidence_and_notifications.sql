alter table public.applications
  add column if not exists secondary_field_of_study text,
  add column if not exists national_exam_result text;

alter table public.applications
  drop constraint if exists applications_secondary_field_of_study_check,
  add constraint applications_secondary_field_of_study_check
    check (secondary_field_of_study is null or char_length(btrim(secondary_field_of_study)) between 2 and 180),
  drop constraint if exists applications_national_exam_result_check,
  add constraint applications_national_exam_result_check
    check (national_exam_result is null or char_length(btrim(national_exam_result)) between 1 and 120);

comment on column public.applications.secondary_field_of_study is
  'Secondary-school combination, trade, option, or field studied by the applicant.';
comment on column public.applications.national_exam_result is
  'Applicant-reported national examination score/result, preserving the official scoring format.';

create table if not exists public.application_email_notifications (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  event text not null check (event in ('submitted','approved','rejected')),
  recipient_email text not null check (char_length(btrim(recipient_email)) between 5 and 320),
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, event)
);

create index if not exists application_email_notifications_status_idx
  on public.application_email_notifications(status, created_at);

alter table public.application_email_notifications enable row level security;
revoke all on public.application_email_notifications from public, anon, authenticated;
grant all on public.application_email_notifications to service_role;

create or replace function private.queue_application_email_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  event_name text;
begin
  if tg_op = 'INSERT' and new.status = 'pending'::public.application_status then
    event_name := 'submitted';
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'approved'::public.application_status then
      event_name := 'approved';
    elsif new.status = 'rejected'::public.application_status then
      event_name := 'rejected';
    end if;
  end if;

  if event_name is not null then
    insert into public.application_email_notifications(application_id, event, recipient_email)
    values (new.id, event_name, lower(btrim(new.email)))
    on conflict (application_id, event) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.queue_application_email_notification() from public, anon, authenticated;
grant execute on function private.queue_application_email_notification() to service_role;

drop trigger if exists applications_queue_email_notification on public.applications;
create trigger applications_queue_email_notification
after insert or update of status on public.applications
for each row execute function private.queue_application_email_notification();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'admission-diplomas',
  'admission-diplomas',
  false,
  8388608,
  array['application/pdf','image/jpeg','image/png']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- New applications are accepted only through the validated server API.
drop policy if exists "anyone can submit a pending application" on public.applications;
