-- Separate academic intake/cohort membership from actual class sections.
create table if not exists public.class_sections (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  year_of_study smallint not null check (year_of_study between 1 and 8),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  capacity integer not null check (capacity between 1 and 500),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists class_sections_cohort_year_name_ci_unique
  on public.class_sections(cohort_id, year_of_study, lower(btrim(name)));
create index if not exists class_sections_department_cohort_idx
  on public.class_sections(department_id, cohort_id, year_of_study, is_active);

alter table public.profiles
  add column if not exists class_section_id uuid references public.class_sections(id) on delete set null;
create index if not exists profiles_class_section_idx on public.profiles(class_section_id) where class_section_id is not null;

create table if not exists public.course_class_assignments (
  course_id uuid not null references public.courses(id) on delete cascade,
  class_section_id uuid not null references public.class_sections(id) on delete cascade,
  lecturer_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (course_id, class_section_id)
);
create index if not exists course_class_assignments_lecturer_idx
  on public.course_class_assignments(lecturer_id, class_section_id);

alter table public.class_sections enable row level security;
alter table public.course_class_assignments enable row level security;
revoke all on public.class_sections from public, anon;
revoke all on public.course_class_assignments from public, anon;
grant select on public.class_sections to authenticated;
grant select on public.course_class_assignments to authenticated;
grant all on public.class_sections to service_role;
grant all on public.course_class_assignments to service_role;

create policy "authorized users read class sections" on public.class_sections
for select to authenticated using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.account_status = 'active'
      and (
        p.role in ('admin','registrar')
        or (p.role = 'hod' and p.department_id = class_sections.department_id)
        or (p.role = 'lecturer' and p.department_id = class_sections.department_id)
        or (p.role = 'student' and p.class_section_id = class_sections.id)
      )
  )
);

create policy "authorized users read class teaching assignments" on public.course_class_assignments
for select to authenticated using (
  exists (
    select 1
    from public.profiles p
    join public.class_sections s on s.id = course_class_assignments.class_section_id
    where p.id = (select auth.uid())
      and p.account_status = 'active'
      and (
        p.role in ('admin','registrar')
        or (p.role = 'hod' and p.department_id = s.department_id)
        or (p.role = 'lecturer' and course_class_assignments.lecturer_id = p.id)
        or (p.role = 'student' and p.class_section_id = s.id)
      )
  )
);

create or replace function public.registrar_create_cohort(
  cohort_name text,
  target_department_id uuid,
  cohort_start_date date,
  cohort_end_date date,
  reviewer_id uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare reviewer public.profiles%rowtype; new_id uuid;
begin
  select * into reviewer from public.profiles where id = reviewer_id and account_status = 'active';
  if not found or reviewer.role not in ('registrar','admin') then raise exception 'Registrar or administrator authorization required' using errcode='42501'; end if;
  if not exists(select 1 from public.departments where id = target_department_id) then raise exception 'Department not found' using errcode='P0002'; end if;
  if char_length(btrim(cohort_name)) not between 2 and 180 then raise exception 'Cohort name is invalid' using errcode='22023'; end if;
  if cohort_end_date is not null and cohort_end_date < cohort_start_date then raise exception 'Cohort end date cannot be before its start date' using errcode='22023'; end if;
  insert into public.cohorts(name, department_id, start_date, end_date)
  values(btrim(cohort_name), target_department_id, cohort_start_date, cohort_end_date) returning id into new_id;
  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values(reviewer_id, 'registrar.cohort.create', 'cohorts', new_id, jsonb_build_object('name', btrim(cohort_name), 'department_id', target_department_id, 'start_date', cohort_start_date, 'end_date', cohort_end_date));
  return new_id;
end $$;

create or replace function public.hod_create_class_section(
  target_cohort_id uuid,
  section_name text,
  section_year_of_study smallint,
  section_capacity integer,
  reviewer_id uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare reviewer public.profiles%rowtype; cohort_department uuid; new_id uuid;
begin
  select * into reviewer from public.profiles where id = reviewer_id and account_status = 'active';
  if not found or reviewer.role not in ('hod','admin') then raise exception 'HOD or administrator authorization required' using errcode='42501'; end if;
  select department_id into cohort_department from public.cohorts where id = target_cohort_id;
  if cohort_department is null then raise exception 'Cohort not found' using errcode='P0002'; end if;
  if reviewer.role = 'hod' and reviewer.department_id is distinct from cohort_department then raise exception 'HODs may create classes only in their own department' using errcode='42501'; end if;
  if section_year_of_study not between 1 and 8 then raise exception 'Year of study is invalid' using errcode='22023'; end if;
  if section_capacity not between 1 and 500 then raise exception 'Class capacity must be between 1 and 500' using errcode='22023'; end if;
  if char_length(btrim(section_name)) not between 1 and 80 then raise exception 'Class name is invalid' using errcode='22023'; end if;
  insert into public.class_sections(cohort_id, department_id, year_of_study, name, capacity, created_by)
  values(target_cohort_id, cohort_department, section_year_of_study, btrim(section_name), section_capacity, reviewer_id) returning id into new_id;
  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values(reviewer_id, 'hod.class.create', 'class_sections', new_id, jsonb_build_object('cohort_id', target_cohort_id, 'department_id', cohort_department, 'year_of_study', section_year_of_study, 'name', btrim(section_name), 'capacity', section_capacity));
  return new_id;
end $$;

create or replace function public.hod_assign_student_class_section(
  target_student_id uuid,
  target_class_section_id uuid,
  reviewer_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare reviewer public.profiles%rowtype; student public.profiles%rowtype; section public.class_sections%rowtype; previous_section uuid; current_size integer;
begin
  select * into reviewer from public.profiles where id = reviewer_id and account_status = 'active';
  if not found or reviewer.role not in ('hod','admin') then raise exception 'HOD or administrator authorization required' using errcode='42501'; end if;
  select * into student from public.profiles where id = target_student_id and role = 'student' for update;
  if not found then raise exception 'Student not found' using errcode='P0002'; end if;
  if student.registration_status <> 'registered' then raise exception 'Only registered students can be assigned to classes' using errcode='22023'; end if;
  select * into section from public.class_sections where id = target_class_section_id and is_active for update;
  if not found then raise exception 'Active class section not found' using errcode='P0002'; end if;
  if student.department_id is distinct from section.department_id then raise exception 'Class must belong to the student department' using errcode='22023'; end if;
  if student.year_of_study is distinct from section.year_of_study then raise exception 'Class must match the student year of study' using errcode='22023'; end if;
  if student.cohort_id is not null and student.cohort_id is distinct from section.cohort_id then raise exception 'Student belongs to a different intake/cohort' using errcode='22023'; end if;
  if reviewer.role = 'hod' and reviewer.department_id is distinct from section.department_id then raise exception 'HODs may assign classes only in their own department' using errcode='42501'; end if;
  select count(*) into current_size from public.profiles where class_section_id = section.id and id <> target_student_id;
  if current_size >= section.capacity then raise exception 'This class has reached its capacity' using errcode='23514'; end if;
  previous_section := student.class_section_id;
  update public.profiles set cohort_id = section.cohort_id, class_section_id = section.id where id = target_student_id;
  update public.enrollments e set status = 'dropped'
    where e.student_id = target_student_id and e.managed_by_cohort and e.status = 'active'
      and (e.source_cohort_id is distinct from section.cohort_id or not exists(select 1 from public.courses c where c.id = e.course_id and c.cohort_id = section.cohort_id));
  insert into public.enrollments(student_id, course_id, status, managed_by_cohort, source_cohort_id)
    select target_student_id, c.id, 'active'::public.enrollment_status, true, section.cohort_id from public.courses c where c.cohort_id = section.cohort_id
    on conflict(student_id, course_id) do update set status = case when public.enrollments.status = 'completed' then 'completed'::public.enrollment_status else 'active'::public.enrollment_status end, managed_by_cohort = true, source_cohort_id = section.cohort_id;
  insert into public.audit_log(actor_id, action, target_table, target_id, old_value, new_value)
  values(reviewer_id, 'hod.student.class.assign', 'profiles', target_student_id,
    jsonb_build_object('class_section_id', previous_section, 'cohort_id', student.cohort_id),
    jsonb_build_object('class_section_id', section.id, 'cohort_id', section.cohort_id));
end $$;

create or replace function public.hod_assign_class_course_lecturer(
  target_course_id uuid,
  target_class_section_id uuid,
  target_lecturer_id uuid,
  reviewer_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare reviewer public.profiles%rowtype; lecturer public.profiles%rowtype; section public.class_sections%rowtype; course_record public.courses%rowtype; previous_lecturer uuid;
begin
  select * into reviewer from public.profiles where id = reviewer_id and account_status = 'active';
  if not found or reviewer.role not in ('hod','admin') then raise exception 'HOD or administrator authorization required' using errcode='42501'; end if;
  select * into section from public.class_sections where id = target_class_section_id and is_active;
  if not found then raise exception 'Active class section not found' using errcode='P0002'; end if;
  select * into course_record from public.courses where id = target_course_id;
  if not found then raise exception 'Course not found' using errcode='P0002'; end if;
  if course_record.department_id is distinct from section.department_id then raise exception 'Course and class must belong to the same department' using errcode='22023'; end if;
  if course_record.cohort_id is null or course_record.cohort_id is distinct from section.cohort_id then raise exception 'Course must be assigned to the same intake/cohort as the class' using errcode='22023'; end if;
  select * into lecturer from public.profiles where id = target_lecturer_id and role in ('lecturer','hod') and account_status = 'active';
  if not found then raise exception 'Active lecturer not found' using errcode='P0002'; end if;
  if lecturer.department_id is distinct from section.department_id then raise exception 'Lecturer and class must belong to the same department' using errcode='22023'; end if;
  if reviewer.role = 'hod' and reviewer.department_id is distinct from section.department_id then raise exception 'HODs may assign teaching only in their own department' using errcode='42501'; end if;
  select lecturer_id into previous_lecturer from public.course_class_assignments where course_id = target_course_id and class_section_id = target_class_section_id;
  insert into public.course_class_assignments(course_id, class_section_id, lecturer_id, assigned_by, assigned_at)
  values(target_course_id, target_class_section_id, target_lecturer_id, reviewer_id, now())
  on conflict(course_id, class_section_id) do update set lecturer_id = excluded.lecturer_id, assigned_by = excluded.assigned_by, assigned_at = now();
  insert into public.audit_log(actor_id, action, target_table, target_id, old_value, new_value)
  values(reviewer_id, 'hod.class.course.lecturer.assign', 'course_class_assignments', target_class_section_id,
    jsonb_build_object('course_id', target_course_id, 'lecturer_id', previous_lecturer),
    jsonb_build_object('course_id', target_course_id, 'lecturer_id', target_lecturer_id));
end $$;

revoke all on function public.registrar_create_cohort(text,uuid,date,date,uuid) from public, anon, authenticated;
revoke all on function public.hod_create_class_section(uuid,text,smallint,integer,uuid) from public, anon, authenticated;
revoke all on function public.hod_assign_student_class_section(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.hod_assign_class_course_lecturer(uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.registrar_create_cohort(text,uuid,date,date,uuid) to service_role;
grant execute on function public.hod_create_class_section(uuid,text,smallint,integer,uuid) to service_role;
grant execute on function public.hod_assign_student_class_section(uuid,uuid,uuid) to service_role;
grant execute on function public.hod_assign_class_course_lecturer(uuid,uuid,uuid,uuid) to service_role;
