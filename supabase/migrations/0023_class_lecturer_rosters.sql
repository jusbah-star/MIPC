-- Give HODs an explicit class lecturer roster, separate from lesson responsibility.
create table if not exists public.class_section_lecturers (
  class_section_id uuid not null references public.class_sections(id) on delete cascade,
  lecturer_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (class_section_id, lecturer_id)
);

create index if not exists class_section_lecturers_lecturer_idx
  on public.class_section_lecturers(lecturer_id, class_section_id);

-- Preserve existing teaching responsibility: anyone already assigned to a class lesson
-- becomes a member of that class lecturer roster automatically.
insert into public.class_section_lecturers(class_section_id, lecturer_id, assigned_by, assigned_at)
select cca.class_section_id, cca.lecturer_id, cca.assigned_by, min(cca.assigned_at)
from public.course_class_assignments cca
group by cca.class_section_id, cca.lecturer_id, cca.assigned_by
on conflict(class_section_id, lecturer_id) do nothing;

alter table public.class_section_lecturers enable row level security;
revoke all on public.class_section_lecturers from public, anon;
grant select on public.class_section_lecturers to authenticated;
grant all on public.class_section_lecturers to service_role;

create policy "authorized users read class lecturer rosters" on public.class_section_lecturers
for select to authenticated using (
  exists (
    select 1
    from public.profiles p
    join public.class_sections s on s.id = class_section_lecturers.class_section_id
    where p.id = (select auth.uid())
      and p.account_status = 'active'
      and (
        p.role in ('admin','registrar')
        or (p.role = 'hod' and p.department_id = s.department_id)
        or (p.role in ('lecturer','hod') and class_section_lecturers.lecturer_id = p.id)
        or (p.role = 'student' and p.class_section_id = s.id)
      )
  )
);

create or replace function private.teaches_student_in_assigned_class(target_student_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1
    from public.class_section_lecturers csl
    join public.profiles teacher on teacher.id = (select auth.uid())
    join public.profiles student on student.id = target_student_id
    where csl.lecturer_id = (select auth.uid())
      and teacher.role in ('lecturer','hod')
      and teacher.account_status = 'active'
      and student.role = 'student'
      and student.class_section_id = csl.class_section_id
  )
$$;

revoke all on function private.teaches_student_in_assigned_class(uuid) from public, anon;
grant execute on function private.teaches_student_in_assigned_class(uuid) to authenticated, service_role;

drop policy if exists "faculty read profiles of their students" on public.profiles;
create policy "faculty read profiles of their students" on public.profiles
for select to authenticated using (
  (select private.auth_role()) in ('lecturer'::public.user_role, 'hod'::public.user_role)
  and (
    private.teaches_student_in_assigned_class(profiles.id)
    or exists (
      select 1
      from public.enrollments e
      join public.courses c on c.id = e.course_id
      where e.student_id = profiles.id
        and e.status = 'active'
        and (
          c.lecturer_id = (select auth.uid())
          or private.teaches_student_in_class(e.course_id, profiles.id)
        )
    )
  )
);

create or replace function public.hod_assign_class_lecturer(
  target_class_section_id uuid,
  target_lecturer_id uuid,
  reviewer_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare reviewer public.profiles%rowtype; lecturer public.profiles%rowtype; section public.class_sections%rowtype;
begin
  select * into reviewer from public.profiles where id = reviewer_id and account_status = 'active';
  if not found or reviewer.role not in ('hod','admin') then raise exception 'HOD or administrator authorization required' using errcode='42501'; end if;
  select * into section from public.class_sections where id = target_class_section_id and is_active;
  if not found then raise exception 'Active class section not found' using errcode='P0002'; end if;
  select * into lecturer from public.profiles where id = target_lecturer_id and role in ('lecturer','hod') and account_status = 'active';
  if not found then raise exception 'Active lecturer not found' using errcode='P0002'; end if;
  if lecturer.department_id is distinct from section.department_id then raise exception 'Lecturer and class must belong to the same department' using errcode='22023'; end if;
  if reviewer.role = 'hod' and reviewer.department_id is distinct from section.department_id then raise exception 'HODs may assign lecturers only in their own department' using errcode='42501'; end if;

  insert into public.class_section_lecturers(class_section_id, lecturer_id, assigned_by, assigned_at)
  values(section.id, lecturer.id, reviewer_id, now())
  on conflict(class_section_id, lecturer_id) do update set assigned_by = excluded.assigned_by, assigned_at = now();

  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values(reviewer_id, 'hod.class.lecturer.assign', 'class_section_lecturers', section.id,
    jsonb_build_object('class_section_id', section.id, 'lecturer_id', lecturer.id));
end $$;

create or replace function public.hod_remove_class_lecturer(
  target_class_section_id uuid,
  target_lecturer_id uuid,
  reviewer_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare reviewer public.profiles%rowtype; section public.class_sections%rowtype;
begin
  select * into reviewer from public.profiles where id = reviewer_id and account_status = 'active';
  if not found or reviewer.role not in ('hod','admin') then raise exception 'HOD or administrator authorization required' using errcode='42501'; end if;
  select * into section from public.class_sections where id = target_class_section_id;
  if not found then raise exception 'Class section not found' using errcode='P0002'; end if;
  if reviewer.role = 'hod' and reviewer.department_id is distinct from section.department_id then raise exception 'HODs may remove lecturers only in their own department' using errcode='42501'; end if;
  if exists(select 1 from public.course_class_assignments where class_section_id = section.id and lecturer_id = target_lecturer_id) then
    raise exception 'Reassign this lecturer lessons before removing them from the class' using errcode='23503';
  end if;

  delete from public.class_section_lecturers
  where class_section_id = section.id and lecturer_id = target_lecturer_id;
  if not found then raise exception 'Lecturer is not assigned to this class' using errcode='P0002'; end if;

  insert into public.audit_log(actor_id, action, target_table, target_id, old_value)
  values(reviewer_id, 'hod.class.lecturer.remove', 'class_section_lecturers', section.id,
    jsonb_build_object('class_section_id', section.id, 'lecturer_id', target_lecturer_id));
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
  if not exists(select 1 from public.class_section_lecturers where class_section_id = section.id and lecturer_id = lecturer.id) then
    raise exception 'Lecturer must be assigned to this class before being assigned to a lesson' using errcode='23503';
  end if;

  select lecturer_id into previous_lecturer from public.course_class_assignments where course_id = target_course_id and class_section_id = target_class_section_id;
  insert into public.course_class_assignments(course_id, class_section_id, lecturer_id, assigned_by, assigned_at)
  values(target_course_id, target_class_section_id, target_lecturer_id, reviewer_id, now())
  on conflict(course_id, class_section_id) do update set lecturer_id = excluded.lecturer_id, assigned_by = excluded.assigned_by, assigned_at = now();
  insert into public.audit_log(actor_id, action, target_table, target_id, old_value, new_value)
  values(reviewer_id, 'hod.class.course.lecturer.assign', 'course_class_assignments', target_class_section_id,
    jsonb_build_object('course_id', target_course_id, 'lecturer_id', previous_lecturer),
    jsonb_build_object('course_id', target_course_id, 'lecturer_id', target_lecturer_id));
end $$;

revoke all on function public.hod_assign_class_lecturer(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.hod_remove_class_lecturer(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.hod_assign_class_course_lecturer(uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.hod_assign_class_lecturer(uuid,uuid,uuid) to service_role;
grant execute on function public.hod_remove_class_lecturer(uuid,uuid,uuid) to service_role;
grant execute on function public.hod_assign_class_course_lecturer(uuid,uuid,uuid,uuid) to service_role;
