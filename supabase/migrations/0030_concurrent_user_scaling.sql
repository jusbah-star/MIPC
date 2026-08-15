-- MIPC concurrency hardening for large student populations and exam bursts.

-- Hot-path indexes for student dashboards, examinations, class management and grading.
create index if not exists questions_test_order_idx
  on public.questions(test_id, order_index, id);
create index if not exists tests_published_course_window_idx
  on public.tests(course_id, available_from, available_until)
  where published = true;
create index if not exists test_attempts_student_status_expiry_idx
  on public.test_attempts(student_id, status, expires_at);
create index if not exists submissions_student_submitted_idx
  on public.submissions(student_id, submitted_at desc);
create index if not exists profiles_registered_department_year_class_idx
  on public.profiles(department_id, year_of_study, cohort_id, class_section_id, full_name)
  where role = 'student' and registration_status = 'registered';

-- Cover previously unindexed foreign keys so deletes, joins and governance writes
-- do not degrade as the college dataset grows.
create index if not exists admin_registration_invites_claimed_by_idx on public.admin_registration_invites(claimed_by);
create index if not exists admin_registration_invites_invited_by_idx on public.admin_registration_invites(invited_by);
create index if not exists announcements_author_id_idx on public.announcements(author_id);
create index if not exists answers_question_id_idx on public.answers(question_id);
create index if not exists applications_department_id_idx on public.applications(department_id);
create index if not exists applications_reviewed_by_idx on public.applications(reviewed_by);
create index if not exists audit_log_actor_id_idx on public.audit_log(actor_id);
create index if not exists class_section_lecturers_assigned_by_idx on public.class_section_lecturers(assigned_by);
create index if not exists class_sections_created_by_idx on public.class_sections(created_by);
create index if not exists cohorts_department_id_idx on public.cohorts(department_id);
create index if not exists course_class_assignments_assigned_by_idx on public.course_class_assignments(assigned_by);
create index if not exists course_class_assignments_class_section_idx on public.course_class_assignments(class_section_id);
create index if not exists course_materials_created_by_idx on public.course_materials(created_by);
create index if not exists data_subject_requests_handled_by_idx on public.data_subject_requests(handled_by);
create index if not exists student_finance_accounts_updated_by_idx on public.student_finance_accounts(updated_by);
create index if not exists student_payments_recorded_by_idx on public.student_payments(recorded_by);
create index if not exists submissions_graded_by_idx on public.submissions(graded_by);
create index if not exists tests_lecturer_id_idx on public.tests(lecturer_id);

-- Avoid re-evaluating auth.uid() once per candidate row on common RLS paths.
drop policy if exists "students read own enrollments" on public.enrollments;
create policy "students read own enrollments"
  on public.enrollments for select to authenticated
  using (student_id = (select auth.uid()));

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "lecturers manage own courses" on public.courses;
create policy "lecturers manage own courses"
  on public.courses for update to authenticated
  using (lecturer_id = (select auth.uid()))
  with check (lecturer_id = (select auth.uid()));

drop policy if exists "lecturers publish course announcements" on public.announcements;
create policy "lecturers publish course announcements"
  on public.announcements for insert to authenticated
  with check (
    scope = 'course'
    and private.teaches_course(course_id)
    and author_id = (select auth.uid())
  );

-- One set-based answer upsert replaces up to 250 per-answer existence checks
-- and insert/update statements inside an autosave transaction.
create or replace function private.upsert_test_answers_internal(
  target_attempt_id uuid,
  target_test_id uuid,
  submitted_answers jsonb
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  input_count integer;
  invalid_count integer;
begin
  if jsonb_typeof(submitted_answers) <> 'array' then
    raise exception 'Invalid answer payload' using errcode = '22023';
  end if;

  input_count := jsonb_array_length(submitted_answers);
  if input_count = 0 then return 0; end if;
  if input_count > 250 then
    raise exception 'Too many answers' using errcode = '22023';
  end if;

  with parsed as (
    select ordinality,
      nullif(item->>'questionId', '')::uuid as question_id,
      left(coalesce(item->>'response', ''), 10000) as response
    from jsonb_array_elements(submitted_answers) with ordinality as source(item, ordinality)
  )
  select count(*) into invalid_count
  from parsed p
  left join public.questions q on q.id = p.question_id and q.test_id = target_test_id
  where p.question_id is null or q.id is null;

  if invalid_count > 0 then
    raise exception 'Question does not belong to this test' using errcode = '22023';
  end if;

  with parsed as (
    select ordinality,
      nullif(item->>'questionId', '')::uuid as question_id,
      left(coalesce(item->>'response', ''), 10000) as response
    from jsonb_array_elements(submitted_answers) with ordinality as source(item, ordinality)
  ), deduplicated as (
    select distinct on (question_id) question_id, response
    from parsed
    order by question_id, ordinality desc
  )
  insert into public.answers(attempt_id, question_id, response)
  select target_attempt_id, question_id, response
  from deduplicated
  on conflict (attempt_id, question_id)
  do update set response = excluded.response;

  return input_count;
end;
$$;
revoke all on function private.upsert_test_answers_internal(uuid, uuid, jsonb) from public, anon, authenticated;

create or replace function private.save_test_answers(target_test_id uuid, submitted_answers jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_attempt public.test_attempts%rowtype;
begin
  if caller_id is null or jsonb_typeof(submitted_answers) <> 'array' or jsonb_array_length(submitted_answers) > 250 then
    raise exception 'Invalid answer payload' using errcode = '22023';
  end if;

  select * into target_attempt
  from public.test_attempts
  where test_id = target_test_id and student_id = caller_id
  for update;

  if not found or target_attempt.status <> 'in_progress' or target_attempt.expires_at <= now() then
    raise exception 'Attempt is not open' using errcode = '55000';
  end if;

  return private.upsert_test_answers_internal(target_attempt.id, target_test_id, submitted_answers);
end;
$$;

create or replace function private.submit_test_attempt(
  target_test_id uuid,
  submitted_answers jsonb default '[]'::jsonb
) returns table (
  attempt_id uuid,
  status public.attempt_status,
  score numeric,
  requires_manual_grading boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_attempt public.test_attempts%rowtype;
  final_status public.attempt_status;
  grade_result record;
begin
  if caller_id is null or jsonb_typeof(submitted_answers) <> 'array' or jsonb_array_length(submitted_answers) > 250 then
    raise exception 'Invalid submission payload' using errcode = '22023';
  end if;

  select * into target_attempt
  from public.test_attempts
  where test_id = target_test_id and student_id = caller_id
  for update;

  if not found then raise exception 'Attempt not found' using errcode = 'P0002'; end if;

  if target_attempt.status <> 'in_progress' then
    return query select target_attempt.id, target_attempt.status, target_attempt.score, target_attempt.requires_manual_grading;
    return;
  end if;

  if target_attempt.expires_at > now() then
    perform private.upsert_test_answers_internal(target_attempt.id, target_test_id, submitted_answers);
    final_status := 'submitted';
  else
    final_status := 'auto_submitted';
  end if;

  update public.test_attempts
  set status = final_status, submitted_at = now()
  where id = target_attempt.id;

  select * into grade_result from private.grade_attempt_internal(target_attempt.id);

  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values (caller_id, 'test.submit', 'test_attempts', target_attempt.id,
    jsonb_build_object('status', final_status, 'score', grade_result.score, 'requires_manual_grading', grade_result.requires_manual_grading));

  return query select target_attempt.id, final_status, grade_result.score, grade_result.requires_manual_grading;
end;
$$;
