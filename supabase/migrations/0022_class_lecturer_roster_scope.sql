-- Allow class-specific lecturers to read only the students in their assigned class sections.
create or replace function private.teaches_student_in_class(target_course_id uuid, target_student_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1
    from public.course_class_assignments cca
    join public.profiles teacher on teacher.id = (select auth.uid())
    join public.profiles student on student.id = target_student_id
    where cca.course_id = target_course_id
      and cca.lecturer_id = (select auth.uid())
      and teacher.role in ('lecturer','hod')
      and teacher.account_status = 'active'
      and student.role = 'student'
      and student.class_section_id = cca.class_section_id
  )
$$;

revoke all on function private.teaches_student_in_class(uuid,uuid) from public, anon;
grant execute on function private.teaches_student_in_class(uuid,uuid) to authenticated, service_role;

drop policy if exists "lecturers read enrollments in their courses" on public.enrollments;
create policy "lecturers read enrollments in their courses" on public.enrollments
for select to authenticated using (
  private.teaches_course(course_id)
  or private.teaches_student_in_class(course_id, student_id)
);

drop policy if exists "faculty read profiles of their students" on public.profiles;
create policy "faculty read profiles of their students" on public.profiles
for select to authenticated using (
  (select private.auth_role()) in ('lecturer'::public.user_role, 'hod'::public.user_role)
  and exists (
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
);
