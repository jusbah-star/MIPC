-- Keep privileged SECURITY DEFINER implementations out of the exposed public schema.
-- Public API compatibility is preserved with SECURITY INVOKER wrappers that retain
-- the existing RPC names while delegating to private implementations.

create schema if not exists private;

-- Move authenticated-callable privileged implementations into private.
alter function public.auth_role() set schema private;
alter function public.is_enrolled(uuid) set schema private;
alter function public.teaches_course(uuid) set schema private;
alter function public.create_test_with_questions(jsonb) set schema private;
alter function public.get_student_questions(uuid) set schema private;
alter function public.grade_assignment(uuid, numeric, text) set schema private;
alter function public.publish_course_material(uuid, text, text, public.material_type, text, text, boolean) set schema private;
alter function public.publish_global_announcement(public.announcement_scope, text, text) set schema private;
alter function public.save_test_answers(uuid, jsonb) set schema private;
alter function public.start_test_attempt(uuid) set schema private;
alter function public.submit_assignment(uuid, text) set schema private;
alter function public.submit_test_attempt(uuid, jsonb) set schema private;

-- Private is never a Data API surface. Only signed-in/server roles need schema usage,
-- and only the specific implementation functions below are executable by them.
revoke all on schema private from PUBLIC, anon;
grant usage on schema private to authenticated, service_role;

revoke execute on all functions in schema private from PUBLIC, anon, authenticated;

grant execute on function private.auth_role() to authenticated, service_role;
grant execute on function private.is_enrolled(uuid) to authenticated, service_role;
grant execute on function private.teaches_course(uuid) to authenticated, service_role;
grant execute on function private.create_test_with_questions(jsonb) to authenticated, service_role;
grant execute on function private.get_student_questions(uuid) to authenticated, service_role;
grant execute on function private.grade_assignment(uuid, numeric, text) to authenticated, service_role;
grant execute on function private.publish_course_material(uuid, text, text, public.material_type, text, text, boolean) to authenticated, service_role;
grant execute on function private.publish_global_announcement(public.announcement_scope, text, text) to authenticated, service_role;
grant execute on function private.save_test_answers(uuid, jsonb) to authenticated, service_role;
grant execute on function private.start_test_attempt(uuid) to authenticated, service_role;
grant execute on function private.submit_assignment(uuid, text) to authenticated, service_role;
grant execute on function private.submit_test_attempt(uuid, jsonb) to authenticated, service_role;

-- Restrict auth-only RLS policies to the authenticated role instead of PUBLIC.
-- This avoids evaluating private authorization helpers for anonymous requests.
alter policy "admins publish any announcement" on public.announcements to authenticated;
alter policy "course announcements readable by enrolled/teaching users" on public.announcements to authenticated;
alter policy "lecturers publish course announcements" on public.announcements to authenticated;
alter policy "public announcements readable by anyone" on public.announcements to anon, authenticated;
alter policy "lecturers read answers on their tests" on public.answers to authenticated;
alter policy "admins manage applications" on public.applications to authenticated;
alter policy "assignments readable by enrolled or teaching users" on public.assignments to authenticated;
alter policy "lecturers manage own course assignments" on public.assignments to authenticated;
alter policy "admins read audit log" on public.audit_log to authenticated;
alter policy "cohorts readable by authenticated users" on public.cohorts to authenticated using (true);
alter policy "cohorts writable by admin" on public.cohorts to authenticated;
alter policy "admins manage all courses" on public.courses to authenticated;
alter policy "courses readable by authenticated users" on public.courses to authenticated using (true);
alter policy "lecturers manage own courses" on public.courses to authenticated;
alter policy "departments readable by authenticated users" on public.departments to authenticated using (true);
alter policy "departments writable by admin" on public.departments to authenticated;
alter policy "admins manage enrollments" on public.enrollments to authenticated;
alter policy "lecturers read enrollments in their courses" on public.enrollments to authenticated;
alter policy "students read own enrollments" on public.enrollments to authenticated;
alter policy "admins manage all profiles" on public.profiles to authenticated;
alter policy "admins read all profiles" on public.profiles to authenticated;
alter policy "lecturers read profiles of their students" on public.profiles to authenticated;
alter policy "read own profile" on public.profiles to authenticated;
alter policy "admins manage all questions" on public.questions to authenticated;
alter policy "lecturers manage questions on own tests" on public.questions to authenticated;
alter policy "lecturers read and grade submissions in their courses" on public.submissions to authenticated;
alter policy "lecturers read attempts on their tests" on public.test_attempts to authenticated;
alter policy "admins read all tests" on public.tests to authenticated;
alter policy "lecturers manage own tests" on public.tests to authenticated;
alter policy "students read published tests in enrolled courses" on public.tests to authenticated;

-- Remove broad function execution grants in the exposed schema now and by default.
revoke execute on all functions in schema public from PUBLIC, anon, authenticated;
alter default privileges in schema public revoke execute on functions from PUBLIC, anon, authenticated;
alter default privileges in schema private revoke execute on functions from PUBLIC, anon, authenticated;

-- Public helper wrappers: API-visible but never privileged themselves.
create function public.auth_role()
returns public.user_role
language sql
stable
security invoker
set search_path = ''
as $$
  select private.auth_role();
$$;

create function public.is_enrolled(target_course_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_enrolled(target_course_id);
$$;

create function public.teaches_course(target_course_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.teaches_course(target_course_id);
$$;

-- Public user-facing RPC wrappers preserve the existing API names/signatures.
create function public.create_test_with_questions(payload jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_test_with_questions(payload);
$$;

create function public.get_student_questions(target_test_id uuid)
returns table(
  id uuid,
  test_id uuid,
  type public.question_type,
  prompt text,
  options jsonb,
  points numeric,
  order_index integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_student_questions(target_test_id);
$$;

create function public.grade_assignment(
  target_submission_id uuid,
  awarded_grade numeric,
  marker_feedback text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.grade_assignment(target_submission_id, awarded_grade, marker_feedback);
$$;

create function public.publish_course_material(
  target_course_id uuid,
  material_title text,
  material_description text,
  material_kind public.material_type,
  material_url text,
  material_content text,
  publish_now boolean
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.publish_course_material(
    target_course_id,
    material_title,
    material_description,
    material_kind,
    material_url,
    material_content,
    publish_now
  );
$$;

create function public.publish_global_announcement(
  announcement_kind public.announcement_scope,
  announcement_title text,
  announcement_body text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.publish_global_announcement(
    announcement_kind,
    announcement_title,
    announcement_body
  );
$$;

create function public.save_test_answers(
  target_test_id uuid,
  submitted_answers jsonb
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.save_test_answers(target_test_id, submitted_answers);
$$;

create function public.start_test_attempt(target_test_id uuid)
returns table(
  attempt_id uuid,
  expires_at timestamptz,
  status public.attempt_status,
  score numeric,
  requires_manual_grading boolean
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.start_test_attempt(target_test_id);
$$;

create function public.submit_assignment(
  target_assignment_id uuid,
  response_content text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.submit_assignment(target_assignment_id, response_content);
$$;

create function public.submit_test_attempt(
  target_test_id uuid,
  submitted_answers jsonb default '[]'::jsonb
)
returns table(
  attempt_id uuid,
  status public.attempt_status,
  score numeric,
  requires_manual_grading boolean
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.submit_test_attempt(target_test_id, submitted_answers);
$$;

-- API wrapper grants are explicit. Anonymous users cannot invoke any of these RPCs.
grant execute on function public.auth_role() to authenticated, service_role;
grant execute on function public.is_enrolled(uuid) to authenticated, service_role;
grant execute on function public.teaches_course(uuid) to authenticated, service_role;
grant execute on function public.create_test_with_questions(jsonb) to authenticated, service_role;
grant execute on function public.get_student_questions(uuid) to authenticated, service_role;
grant execute on function public.grade_assignment(uuid, numeric, text) to authenticated, service_role;
grant execute on function public.publish_course_material(uuid, text, text, public.material_type, text, text, boolean) to authenticated, service_role;
grant execute on function public.publish_global_announcement(public.announcement_scope, text, text) to authenticated, service_role;
grant execute on function public.save_test_answers(uuid, jsonb) to authenticated, service_role;
grant execute on function public.start_test_attempt(uuid) to authenticated, service_role;
grant execute on function public.submit_assignment(uuid, text) to authenticated, service_role;
grant execute on function public.submit_test_attempt(uuid, jsonb) to authenticated, service_role;

comment on schema private is
  'Non-exposed implementation schema for privileged MIPC database routines.';
