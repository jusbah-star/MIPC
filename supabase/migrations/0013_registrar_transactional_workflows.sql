-- =========================================================================
-- 0013_registrar_transactional_workflows.sql
-- Versions the live registrar schema drift, makes registrar database changes
-- transactional, and reconciles cohort-managed course enrollments safely.
-- =========================================================================

-- Admission-to-student linkage existed in production before it was committed.
alter table public.applications
  add column if not exists enrolled_student_id uuid references public.profiles(id) on delete set null;

alter table public.applications
  add column if not exists enrolled_at timestamptz;

-- Track which enrollments are institution-managed by cohort automation so a
-- cohort change can retire only automatic enrollments, preserving manual ones.
alter table public.enrollments
  add column if not exists managed_by_cohort boolean not null default false;

alter table public.enrollments
  add column if not exists source_cohort_id uuid references public.cohorts(id) on delete set null;

create index if not exists enrollments_cohort_managed_idx
  on public.enrollments(student_id, managed_by_cohort, source_cohort_id, status);

-- The live project already auto-enrolled some students before source tracking
-- existed. Backfill only active enrollments where student and course currently
-- share the same cohort; unrelated/manual enrollments remain untouched.
update public.enrollments e
set managed_by_cohort = true,
    source_cohort_id = p.cohort_id
from public.profiles p, public.courses c
where e.student_id = p.id
  and e.course_id = c.id
  and e.status = 'active'
  and p.role = 'student'
  and p.cohort_id is not null
  and c.cohort_id = p.cohort_id
  and not e.managed_by_cohort;

-- -------------------------------------------------------------------------
-- Cohort enrollment reconciliation.
-- These functions are callable only by service_role. They verify the acting
-- administrator in the database before performing privileged changes.
-- -------------------------------------------------------------------------

create or replace function public.sync_student_cohort_enrollments(
  target_student_id uuid,
  reviewer_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_cohort_id uuid;
  target_status public.account_status;
  activated_count integer := 0;
  dropped_count integer := 0;
begin
  if not exists (
    select 1 from public.profiles
    where id = reviewer_id and role = 'admin' and account_status = 'active'
  ) then
    raise exception 'Administrator authorization required' using errcode = '42501';
  end if;

  select p.cohort_id, p.account_status
    into target_cohort_id, target_status
  from public.profiles p
  where p.id = target_student_id and p.role = 'student'
  for update;

  if not found then
    raise exception 'Student record not found' using errcode = 'P0002';
  end if;

  update public.enrollments e
  set status = 'dropped'
  where e.student_id = target_student_id
    and e.managed_by_cohort
    and e.status = 'active'
    and (
      target_status <> 'active'
      or target_cohort_id is null
      or e.source_cohort_id is distinct from target_cohort_id
      or not exists (
        select 1 from public.courses c
        where c.id = e.course_id and c.cohort_id = target_cohort_id
      )
    );
  get diagnostics dropped_count = row_count;

  if target_status = 'active' and target_cohort_id is not null then
    insert into public.enrollments(
      student_id, course_id, status, managed_by_cohort, source_cohort_id
    )
    select
      target_student_id,
      c.id,
      'active'::public.enrollment_status,
      true,
      target_cohort_id
    from public.courses c
    where c.cohort_id = target_cohort_id
    on conflict (student_id, course_id) do update
      set status = case
        when public.enrollments.status = 'completed'
          then 'completed'::public.enrollment_status
        else 'active'::public.enrollment_status
      end,
      managed_by_cohort = true,
      source_cohort_id = target_cohort_id;
    get diagnostics activated_count = row_count;
  end if;

  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values (
    reviewer_id,
    'student.courses.sync',
    'profiles',
    target_student_id,
    jsonb_build_object(
      'cohort_id', target_cohort_id,
      'activated_or_confirmed', activated_count,
      'dropped', dropped_count
    )
  );

  return activated_count;
end;
$$;

create or replace function public.sync_course_cohort_enrollments(
  target_course_id uuid,
  reviewer_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_cohort_id uuid;
  activated_count integer := 0;
  dropped_count integer := 0;
begin
  if not exists (
    select 1 from public.profiles
    where id = reviewer_id and role = 'admin' and account_status = 'active'
  ) then
    raise exception 'Administrator authorization required' using errcode = '42501';
  end if;

  select c.cohort_id into target_cohort_id
  from public.courses c
  where c.id = target_course_id
  for update;

  if not found then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;

  update public.enrollments e
  set status = 'dropped'
  where e.course_id = target_course_id
    and e.managed_by_cohort
    and e.status = 'active'
    and (
      target_cohort_id is null
      or not exists (
        select 1 from public.profiles p
        where p.id = e.student_id
          and p.role = 'student'
          and p.account_status = 'active'
          and p.cohort_id = target_cohort_id
      )
    );
  get diagnostics dropped_count = row_count;

  if target_cohort_id is not null then
    insert into public.enrollments(
      student_id, course_id, status, managed_by_cohort, source_cohort_id
    )
    select
      p.id,
      target_course_id,
      'active'::public.enrollment_status,
      true,
      target_cohort_id
    from public.profiles p
    where p.role = 'student'
      and p.account_status = 'active'
      and p.cohort_id = target_cohort_id
    on conflict (student_id, course_id) do update
      set status = case
        when public.enrollments.status = 'completed'
          then 'completed'::public.enrollment_status
        else 'active'::public.enrollment_status
      end,
      managed_by_cohort = true,
      source_cohort_id = target_cohort_id;
    get diagnostics activated_count = row_count;
  end if;

  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values (
    reviewer_id,
    'course.students.sync',
    'courses',
    target_course_id,
    jsonb_build_object(
      'cohort_id', target_cohort_id,
      'activated_or_confirmed', activated_count,
      'dropped', dropped_count
    )
  );

  return activated_count;
end;
$$;

-- -------------------------------------------------------------------------
-- Transactional registrar mutations.
-- Each function is a single PostgreSQL transaction including audit logging.
-- -------------------------------------------------------------------------

create or replace function public.record_application_approval(
  target_application_id uuid,
  reviewer_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_status public.application_status;
begin
  if not exists (
    select 1 from public.profiles
    where id = reviewer_id and role = 'admin' and account_status = 'active'
  ) then
    raise exception 'Administrator authorization required' using errcode = '42501';
  end if;

  select a.status into previous_status
  from public.applications a
  where a.id = target_application_id
  for update;

  if not found or previous_status not in ('pending', 'under_review') then
    raise exception 'Pending application not found' using errcode = 'P0002';
  end if;

  update public.applications
  set status = 'approved', reviewed_by = reviewer_id, reviewed_at = now()
  where id = target_application_id;

  insert into public.audit_log(actor_id, action, target_table, target_id, old_value, new_value)
  values (
    reviewer_id,
    'application.approve',
    'applications',
    target_application_id,
    jsonb_build_object('status', previous_status),
    jsonb_build_object('status', 'approved')
  );
end;
$$;

create or replace function public.admin_create_cohort(
  cohort_name text,
  target_department_id uuid,
  cohort_start_date date,
  cohort_end_date date,
  reviewer_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = reviewer_id and role = 'admin' and account_status = 'active'
  ) then
    raise exception 'Administrator authorization required' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(cohort_name, ''))) not between 2 and 180 then
    raise exception 'Cohort name is invalid' using errcode = '22023';
  end if;
  if cohort_end_date is not null and cohort_end_date < cohort_start_date then
    raise exception 'Cohort end date cannot be before its start date' using errcode = '22023';
  end if;
  if not exists (select 1 from public.departments where id = target_department_id) then
    raise exception 'Department not found' using errcode = 'P0002';
  end if;

  insert into public.cohorts(name, department_id, start_date, end_date)
  values (left(btrim(cohort_name), 180), target_department_id, cohort_start_date, cohort_end_date)
  returning id into created_id;

  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values (
    reviewer_id,
    'cohort.create',
    'cohorts',
    created_id,
    jsonb_build_object(
      'name', left(btrim(cohort_name), 180),
      'department_id', target_department_id,
      'start_date', cohort_start_date,
      'end_date', cohort_end_date
    )
  );

  return created_id;
end;
$$;

create or replace function public.admin_create_course(
  course_code text,
  course_title text,
  course_description text,
  target_department_id uuid,
  target_cohort_id uuid,
  course_credits integer,
  reviewer_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = reviewer_id and role = 'admin' and account_status = 'active'
  ) then
    raise exception 'Administrator authorization required' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(course_code, ''))) not between 2 and 40 then
    raise exception 'Course code is invalid' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(course_title, ''))) not between 2 and 180 then
    raise exception 'Course title is invalid' using errcode = '22023';
  end if;
  if course_description is not null and char_length(course_description) > 2000 then
    raise exception 'Course description is too long' using errcode = '22023';
  end if;
  if course_credits not between 1 and 60 then
    raise exception 'Credits must be between 1 and 60' using errcode = '22023';
  end if;
  if not exists (select 1 from public.departments where id = target_department_id) then
    raise exception 'Department not found' using errcode = 'P0002';
  end if;
  if target_cohort_id is not null and not exists (
    select 1 from public.cohorts
    where id = target_cohort_id and department_id = target_department_id
  ) then
    raise exception 'Selected cohort does not belong to the selected department' using errcode = '22023';
  end if;

  insert into public.courses(code, title, description, department_id, cohort_id, credits)
  values (
    upper(btrim(course_code)),
    left(btrim(course_title), 180),
    nullif(left(btrim(coalesce(course_description, '')), 2000), ''),
    target_department_id,
    target_cohort_id,
    course_credits
  )
  returning id into created_id;

  if target_cohort_id is not null then
    perform public.sync_course_cohort_enrollments(created_id, reviewer_id);
  end if;

  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values (
    reviewer_id,
    'course.create',
    'courses',
    created_id,
    jsonb_build_object(
      'code', upper(btrim(course_code)),
      'title', left(btrim(course_title), 180),
      'department_id', target_department_id,
      'cohort_id', target_cohort_id,
      'credits', course_credits
    )
  );

  return created_id;
end;
$$;

create or replace function public.admin_create_student_profile(
  target_student_id uuid,
  student_full_name text,
  student_email text,
  student_registration_number text,
  target_department_id uuid,
  target_cohort_id uuid,
  student_year_of_study smallint,
  reviewer_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = reviewer_id and role = 'admin' and account_status = 'active'
  ) then
    raise exception 'Administrator authorization required' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles where id = target_student_id) then
    raise exception 'Student profile already exists' using errcode = '23505';
  end if;
  if student_year_of_study is not null and student_year_of_study not between 1 and 8 then
    raise exception 'Year of study is invalid' using errcode = '22023';
  end if;
  if target_department_id is not null and not exists (
    select 1 from public.departments where id = target_department_id
  ) then
    raise exception 'Department not found' using errcode = 'P0002';
  end if;
  if target_cohort_id is not null and not exists (
    select 1 from public.cohorts
    where id = target_cohort_id and department_id = target_department_id
  ) then
    raise exception 'Selected cohort does not belong to the selected department' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.profiles
    where upper(registration_number) = upper(btrim(student_registration_number))
  ) then
    raise exception 'Registration number is already assigned' using errcode = '23505';
  end if;
  if exists (
    select 1 from public.profiles
    where lower(email) = lower(btrim(student_email))
  ) then
    raise exception 'Email address is already assigned' using errcode = '23505';
  end if;

  insert into public.profiles(
    id, role, full_name, email, registration_number,
    department_id, cohort_id, year_of_study, account_status
  ) values (
    target_student_id,
    'student',
    left(btrim(student_full_name), 160),
    lower(btrim(student_email)),
    upper(btrim(student_registration_number)),
    target_department_id,
    target_cohort_id,
    student_year_of_study,
    'active'
  );

  perform public.sync_student_cohort_enrollments(target_student_id, reviewer_id);

  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values (
    reviewer_id,
    'student.create',
    'profiles',
    target_student_id,
    jsonb_build_object(
      'full_name', left(btrim(student_full_name), 160),
      'email', lower(btrim(student_email)),
      'registration_number', upper(btrim(student_registration_number)),
      'department_id', target_department_id,
      'cohort_id', target_cohort_id,
      'year_of_study', student_year_of_study,
      'account_status', 'active'
    )
  );
end;
$$;

create or replace function public.admin_update_student(
  target_student_id uuid,
  student_full_name text,
  student_email text,
  student_registration_number text,
  target_department_id uuid,
  target_cohort_id uuid,
  student_year_of_study smallint,
  new_account_status public.account_status,
  reviewer_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous public.profiles%rowtype;
begin
  if not exists (
    select 1 from public.profiles
    where id = reviewer_id and role = 'admin' and account_status = 'active'
  ) then
    raise exception 'Administrator authorization required' using errcode = '42501';
  end if;

  select * into previous
  from public.profiles
  where id = target_student_id and role = 'student'
  for update;
  if not found then
    raise exception 'Student record not found' using errcode = 'P0002';
  end if;

  if student_year_of_study is not null and student_year_of_study not between 1 and 8 then
    raise exception 'Year of study is invalid' using errcode = '22023';
  end if;
  if target_department_id is not null and not exists (
    select 1 from public.departments where id = target_department_id
  ) then
    raise exception 'Department not found' using errcode = 'P0002';
  end if;
  if target_cohort_id is not null and not exists (
    select 1 from public.cohorts
    where id = target_cohort_id and department_id = target_department_id
  ) then
    raise exception 'Selected cohort does not belong to the selected department' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.profiles
    where id <> target_student_id
      and upper(registration_number) = upper(btrim(student_registration_number))
  ) then
    raise exception 'Registration number is already assigned' using errcode = '23505';
  end if;
  if exists (
    select 1 from public.profiles
    where id <> target_student_id
      and lower(email) = lower(btrim(student_email))
  ) then
    raise exception 'Email address is already assigned' using errcode = '23505';
  end if;

  update public.profiles
  set full_name = left(btrim(student_full_name), 160),
      email = lower(btrim(student_email)),
      registration_number = upper(btrim(student_registration_number)),
      department_id = target_department_id,
      cohort_id = target_cohort_id,
      year_of_study = student_year_of_study,
      account_status = new_account_status
  where id = target_student_id;

  perform public.sync_student_cohort_enrollments(target_student_id, reviewer_id);

  insert into public.audit_log(actor_id, action, target_table, target_id, old_value, new_value)
  values (
    reviewer_id,
    'student.registry.update',
    'profiles',
    target_student_id,
    jsonb_build_object(
      'full_name', previous.full_name,
      'email', previous.email,
      'registration_number', previous.registration_number,
      'department_id', previous.department_id,
      'cohort_id', previous.cohort_id,
      'year_of_study', previous.year_of_study,
      'account_status', previous.account_status
    ),
    jsonb_build_object(
      'full_name', left(btrim(student_full_name), 160),
      'email', lower(btrim(student_email)),
      'registration_number', upper(btrim(student_registration_number)),
      'department_id', target_department_id,
      'cohort_id', target_cohort_id,
      'year_of_study', student_year_of_study,
      'account_status', new_account_status
    )
  );
end;
$$;

create or replace function public.admin_enroll_application_student(
  target_application_id uuid,
  target_student_id uuid,
  student_registration_number text,
  target_department_id uuid,
  target_cohort_id uuid,
  student_year_of_study smallint,
  reviewer_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_record public.applications%rowtype;
  existing_role public.user_role;
  final_department_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = reviewer_id and role = 'admin' and account_status = 'active'
  ) then
    raise exception 'Administrator authorization required' using errcode = '42501';
  end if;

  select * into application_record
  from public.applications
  where id = target_application_id
  for update;

  if not found or application_record.status <> 'approved' then
    raise exception 'Approved application not found' using errcode = 'P0002';
  end if;
  if application_record.enrolled_student_id is not null then
    raise exception 'This applicant is already enrolled' using errcode = '23505';
  end if;

  final_department_id := coalesce(target_department_id, application_record.department_id);
  if final_department_id is null then
    raise exception 'Department of study is required before enrollment' using errcode = '22023';
  end if;
  if not exists (select 1 from public.departments where id = final_department_id) then
    raise exception 'Department not found' using errcode = 'P0002';
  end if;
  if student_year_of_study is not null and student_year_of_study not between 1 and 8 then
    raise exception 'Year of study is invalid' using errcode = '22023';
  end if;
  if target_cohort_id is not null and not exists (
    select 1 from public.cohorts
    where id = target_cohort_id and department_id = final_department_id
  ) then
    raise exception 'Selected cohort does not belong to the selected department' using errcode = '22023';
  end if;

  select p.role into existing_role
  from public.profiles p
  where p.id = target_student_id
  for update;
  if found and existing_role <> 'student' then
    raise exception 'This account is not a student account' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.profiles
    where id <> target_student_id
      and upper(registration_number) = upper(btrim(student_registration_number))
  ) then
    raise exception 'Registration number is already assigned' using errcode = '23505';
  end if;
  if exists (
    select 1 from public.profiles
    where id <> target_student_id
      and lower(email) = lower(btrim(application_record.email))
  ) then
    raise exception 'Email address is already assigned' using errcode = '23505';
  end if;

  insert into public.profiles(
    id, role, full_name, email, registration_number,
    department_id, cohort_id, year_of_study, account_status
  ) values (
    target_student_id,
    'student',
    application_record.full_name,
    lower(btrim(application_record.email)),
    upper(btrim(student_registration_number)),
    final_department_id,
    target_cohort_id,
    student_year_of_study,
    'active'
  )
  on conflict (id) do update
    set role = 'student',
        full_name = excluded.full_name,
        email = excluded.email,
        registration_number = excluded.registration_number,
        department_id = excluded.department_id,
        cohort_id = excluded.cohort_id,
        year_of_study = excluded.year_of_study,
        account_status = 'active';

  perform public.sync_student_cohort_enrollments(target_student_id, reviewer_id);

  update public.applications
  set enrolled_student_id = target_student_id,
      enrolled_at = now()
  where id = target_application_id;

  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values (
    reviewer_id,
    'application.enroll_student',
    'applications',
    target_application_id,
    jsonb_build_object(
      'student_id', target_student_id,
      'registration_number', upper(btrim(student_registration_number)),
      'department_id', final_department_id,
      'cohort_id', target_cohort_id,
      'year_of_study', student_year_of_study,
      'enrolled_at', now()
    )
  );
end;
$$;

-- Protect every privileged registrar function from browser/Data API roles.
revoke all on function public.sync_student_cohort_enrollments(uuid, uuid) from public, anon, authenticated;
revoke all on function public.sync_course_cohort_enrollments(uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_application_approval(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_create_cohort(text, uuid, date, date, uuid) from public, anon, authenticated;
revoke all on function public.admin_create_course(text, text, text, uuid, uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.admin_create_student_profile(uuid, text, text, text, uuid, uuid, smallint, uuid) from public, anon, authenticated;
revoke all on function public.admin_update_student(uuid, text, text, text, uuid, uuid, smallint, public.account_status, uuid) from public, anon, authenticated;
revoke all on function public.admin_enroll_application_student(uuid, uuid, text, uuid, uuid, smallint, uuid) from public, anon, authenticated;

grant execute on function public.sync_student_cohort_enrollments(uuid, uuid) to service_role;
grant execute on function public.sync_course_cohort_enrollments(uuid, uuid) to service_role;
grant execute on function public.record_application_approval(uuid, uuid) to service_role;
grant execute on function public.admin_create_cohort(text, uuid, date, date, uuid) to service_role;
grant execute on function public.admin_create_course(text, text, text, uuid, uuid, integer, uuid) to service_role;
grant execute on function public.admin_create_student_profile(uuid, text, text, text, uuid, uuid, smallint, uuid) to service_role;
grant execute on function public.admin_update_student(uuid, text, text, text, uuid, uuid, smallint, public.account_status, uuid) to service_role;
grant execute on function public.admin_enroll_application_student(uuid, uuid, text, uuid, uuid, smallint, uuid) to service_role;
