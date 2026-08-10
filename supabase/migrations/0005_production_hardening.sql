-- =========================================================================
-- 0005_production_hardening.sql
-- Production security, assessment integrity, and Rwanda DPP readiness.
-- =========================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- Bring the live schema in line with the application.
-- -------------------------------------------------------------------------

alter table tests add column if not exists passing_score numeric not null default 50;
alter table test_attempts add column if not exists requires_manual_grading boolean not null default false;
alter table applications add column if not exists statement text;
alter table applications add column if not exists privacy_consent_at timestamptz;
alter table submissions add column if not exists content text;
alter table submissions alter column file_path drop not null;

insert into departments (id, name, code) values
  ('b1000000-0000-4000-8000-000000000001', 'Engineering Technology', 'ENGTECH'),
  ('b1000000-0000-4000-8000-000000000002', 'Hospitality and Tourism', 'HOSPTOUR'),
  ('b1000000-0000-4000-8000-000000000003', 'Information and Communication Technology', 'ICT'),
  ('b1000000-0000-4000-8000-000000000004', 'Technical Secondary School and TVET', 'TSS')
on conflict (code) do update set name = excluded.name;

alter type attempt_status add value if not exists 'graded';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tests_duration_positive') then
    alter table tests add constraint tests_duration_positive check (duration_minutes between 1 and 480);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tests_passing_score_valid') then
    alter table tests add constraint tests_passing_score_valid check (passing_score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'questions_points_positive') then
    alter table questions add constraint questions_points_positive check (points > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'applications_statement_length') then
    alter table applications add constraint applications_statement_length check (char_length(statement) <= 5000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'submissions_content_or_file') then
    alter table submissions add constraint submissions_content_or_file
      check (nullif(btrim(content), '') is not null or nullif(btrim(file_path), '') is not null);
  end if;
end $$;

create unique index if not exists submissions_student_assignment_unique
  on submissions(student_id, assignment_id) where assignment_id is not null;

-- -------------------------------------------------------------------------
-- Rwanda Data Protection and Privacy Law readiness.
-- Requests remain append-only operational records with a 30-day target.
-- -------------------------------------------------------------------------

create type data_request_type as enum ('access', 'rectification', 'restriction', 'erasure', 'portability', 'objection');
create type data_request_status as enum ('received', 'identity_verification', 'in_review', 'completed', 'declined');

create table data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  request_type data_request_type not null,
  full_name text not null check (char_length(full_name) between 2 and 160),
  email text not null check (char_length(email) between 5 and 320),
  details text not null check (char_length(details) between 10 and 5000),
  status data_request_status not null default 'received',
  received_at timestamptz not null default now(),
  due_at timestamptz not null default (now() + interval '30 days'),
  resolved_at timestamptz,
  handled_by uuid references profiles(id) on delete set null
);

create index data_subject_requests_status_due_idx on data_subject_requests(status, due_at);
alter table data_subject_requests enable row level security;

create policy "admins manage data subject requests"
  on data_subject_requests for all to authenticated
  using ((select auth_role()) = 'admin')
  with check ((select auth_role()) = 'admin');

-- -------------------------------------------------------------------------
-- Correct overly broad policies. Direct clients can read their data; all
-- authoritative assessment writes happen through the RPCs below.
-- -------------------------------------------------------------------------

drop policy if exists "users update own non-role fields" on profiles;

drop policy if exists "anyone can submit an application" on applications;
create policy "anyone can submit a pending application"
  on applications for insert to anon, authenticated
  with check (
    status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and privacy_consent_at is not null
  );

drop policy if exists "students manage own attempts" on test_attempts;
create policy "students read own attempts"
  on test_attempts for select to authenticated
  using (student_id = (select auth.uid()));
create policy "admins read all attempts"
  on test_attempts for select to authenticated
  using ((select auth_role()) = 'admin');

drop policy if exists "students manage own answers while in progress" on answers;
create policy "students read own answers"
  on answers for select to authenticated
  using (
    exists (
      select 1 from test_attempts a
      where a.id = answers.attempt_id and a.student_id = (select auth.uid())
    )
  );
create policy "admins read all answers"
  on answers for select to authenticated
  using ((select auth_role()) = 'admin');

drop policy if exists "authenticated users can write audit entries" on audit_log;

drop policy if exists "students manage own submissions" on submissions;
create policy "students read own submissions"
  on submissions for select to authenticated
  using (student_id = (select auth.uid()));

-- Students must not query the base question table or a definer-owned view.
drop view if exists questions_for_student;
revoke all on questions from anon, authenticated;
grant select, insert, update, delete on questions to authenticated;

-- -------------------------------------------------------------------------
-- Private grading implementation. Scores are percentages (0-100), matching
-- the UI and passing_score. Essay tests remain marked for human review.
-- -------------------------------------------------------------------------

create or replace function private.grade_attempt_internal(target_attempt_id uuid)
returns table(score numeric, requires_manual_grading boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  total_points numeric;
  awarded_points numeric;
  needs_review boolean;
  calculated_score numeric;
  manual_required boolean;
begin
  update public.answers a
  set points_awarded = case
    when q.type in ('mcq', 'short_answer') then
      case
        when lower(btrim(coalesce(a.response, ''))) = lower(btrim(coalesce(q.correct_answer, '')))
          and nullif(btrim(coalesce(q.correct_answer, '')), '') is not null
        then q.points else 0 end
    else null
  end
  from public.questions q
  where q.id = a.question_id and a.attempt_id = target_attempt_id;

  select coalesce(sum(q.points), 0), bool_or(q.type = 'essay')
    into total_points, needs_review
  from public.questions q
  join public.test_attempts ta on ta.test_id = q.test_id
  where ta.id = target_attempt_id;

  select coalesce(sum(a.points_awarded), 0)
    into awarded_points
  from public.answers a
  where a.attempt_id = target_attempt_id;

  calculated_score := case when total_points > 0 then round((awarded_points / total_points) * 100, 2) else 0 end;
  manual_required := coalesce(needs_review, false);

  update public.test_attempts
  set score = calculated_score,
      requires_manual_grading = manual_required
  where id = target_attempt_id;

  score := calculated_score;
  requires_manual_grading := manual_required;
  return next;
end;
$$;

revoke all on function private.grade_attempt_internal(uuid) from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- Student-facing question retrieval. The answer key is never returned.
-- -------------------------------------------------------------------------

create or replace function get_student_questions(target_test_id uuid)
returns table (
  id uuid,
  test_id uuid,
  type question_type,
  prompt text,
  options jsonb,
  points numeric,
  order_index int
)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, q.test_id, q.type, q.prompt, q.options, q.points, q.order_index
  from public.questions q
  join public.tests t on t.id = q.test_id
  where q.test_id = target_test_id
    and t.published
    and now() between t.available_from and t.available_until
    and exists (
      select 1 from public.enrollments e
      where e.course_id = t.course_id
        and e.student_id = (select auth.uid())
        and e.status = 'active'
    )
    and exists (
      select 1 from public.test_attempts ta
      where ta.test_id = t.id
        and ta.student_id = (select auth.uid())
        and ta.status = 'in_progress'
        and ta.expires_at > now()
    )
  order by q.order_index, q.id;
$$;

revoke all on function get_student_questions(uuid) from public, anon;
grant execute on function get_student_questions(uuid) to authenticated;

-- -------------------------------------------------------------------------
-- Atomic, idempotent assessment lifecycle.
-- -------------------------------------------------------------------------

create or replace function start_test_attempt(target_test_id uuid)
returns table (
  attempt_id uuid,
  expires_at timestamptz,
  status attempt_status,
  score numeric,
  requires_manual_grading boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_test public.tests%rowtype;
  existing public.test_attempts%rowtype;
begin
  if caller_id is null or public.auth_role() <> 'student' then
    raise exception 'Student authentication required' using errcode = '42501';
  end if;

  select * into target_test from public.tests where id = target_test_id;
  if not found or not target_test.published then
    raise exception 'Test not found' using errcode = 'P0002';
  end if;
  if now() not between target_test.available_from and target_test.available_until then
    raise exception 'Test is not currently available' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.enrollments
    where student_id = caller_id and course_id = target_test.course_id and status = 'active'
  ) then
    raise exception 'Active course enrollment required' using errcode = '42501';
  end if;

  select * into existing
  from public.test_attempts
  where test_id = target_test_id and student_id = caller_id
  for update;

  if found then
    if existing.status = 'in_progress' and existing.expires_at <= now() then
      update public.test_attempts
      set status = 'auto_submitted', submitted_at = now()
      where id = existing.id;
      perform private.grade_attempt_internal(existing.id);
      select * into existing from public.test_attempts where id = existing.id;
    end if;
  else
    insert into public.test_attempts(test_id, student_id, expires_at)
    values (
      target_test_id,
      caller_id,
      least(now() + make_interval(mins => target_test.duration_minutes), target_test.available_until)
    )
    returning * into existing;
  end if;

  return query select existing.id, existing.expires_at, existing.status, existing.score, existing.requires_manual_grading;
end;
$$;

revoke all on function start_test_attempt(uuid) from public, anon;
grant execute on function start_test_attempt(uuid) to authenticated;

create or replace function save_test_answers(target_test_id uuid, submitted_answers jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_attempt public.test_attempts%rowtype;
  item jsonb;
  saved_count int := 0;
  question_uuid uuid;
  answer_text text;
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

  for item in select value from jsonb_array_elements(submitted_answers)
  loop
    question_uuid := nullif(item->>'questionId', '')::uuid;
    answer_text := left(coalesce(item->>'response', ''), 10000);
    if not exists (select 1 from public.questions where id = question_uuid and test_id = target_test_id) then
      raise exception 'Question does not belong to this test' using errcode = '22023';
    end if;

    insert into public.answers(attempt_id, question_id, response)
    values (target_attempt.id, question_uuid, answer_text)
    on conflict (attempt_id, question_id) do update set response = excluded.response;
    saved_count := saved_count + 1;
  end loop;

  return saved_count;
end;
$$;

revoke all on function save_test_answers(uuid, jsonb) from public, anon;
grant execute on function save_test_answers(uuid, jsonb) to authenticated;

create or replace function submit_test_attempt(target_test_id uuid, submitted_answers jsonb default '[]'::jsonb)
returns table (
  attempt_id uuid,
  status attempt_status,
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
  item jsonb;
  question_uuid uuid;
  answer_text text;
  final_status attempt_status;
  grade_result record;
begin
  if caller_id is null or jsonb_typeof(submitted_answers) <> 'array' or jsonb_array_length(submitted_answers) > 250 then
    raise exception 'Invalid submission payload' using errcode = '22023';
  end if;

  select * into target_attempt
  from public.test_attempts
  where test_id = target_test_id and student_id = caller_id
  for update;

  if not found then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;

  if target_attempt.status <> 'in_progress' then
    return query select target_attempt.id, target_attempt.status, target_attempt.score, target_attempt.requires_manual_grading;
    return;
  end if;

  if target_attempt.expires_at > now() then
    for item in select value from jsonb_array_elements(submitted_answers)
    loop
      question_uuid := nullif(item->>'questionId', '')::uuid;
      answer_text := left(coalesce(item->>'response', ''), 10000);
      if not exists (select 1 from public.questions where id = question_uuid and test_id = target_test_id) then
        raise exception 'Question does not belong to this test' using errcode = '22023';
      end if;
      insert into public.answers(attempt_id, question_id, response)
      values (target_attempt.id, question_uuid, answer_text)
      on conflict (attempt_id, question_id) do update set response = excluded.response;
    end loop;
    final_status := 'submitted';
  else
    final_status := 'auto_submitted';
  end if;

  update public.test_attempts
  set status = final_status, submitted_at = now()
  where id = target_attempt.id;

  select * into grade_result from private.grade_attempt_internal(target_attempt.id);

  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values (
    caller_id,
    'test.submit',
    'test_attempts',
    target_attempt.id,
    jsonb_build_object('status', final_status, 'score', grade_result.score, 'requires_manual_grading', grade_result.requires_manual_grading)
  );

  return query select target_attempt.id, final_status, grade_result.score, grade_result.requires_manual_grading;
end;
$$;

revoke all on function submit_test_attempt(uuid, jsonb) from public, anon;
grant execute on function submit_test_attempt(uuid, jsonb) to authenticated;

-- Expiry remains schedulable by the service role, never by browser users.
create or replace function finalize_expired_attempts() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired record;
begin
  for expired in
    select id from public.test_attempts
    where status = 'in_progress' and expires_at <= now()
    for update skip locked
  loop
    update public.test_attempts
    set status = 'auto_submitted', submitted_at = now()
    where id = expired.id and status = 'in_progress';
    perform private.grade_attempt_internal(expired.id);
  end loop;
end;
$$;

revoke all on function finalize_expired_attempts() from public, anon, authenticated;
grant execute on function finalize_expired_attempts() to service_role;

drop function if exists grade_attempt(uuid);

-- -------------------------------------------------------------------------
-- Durable coursework and assessment-authoring workflows.
-- -------------------------------------------------------------------------

create or replace function submit_assignment(target_assignment_id uuid, response_content text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_assignment public.assignments%rowtype;
  submission_id uuid;
begin
  if caller_id is null or public.auth_role() <> 'student' then
    raise exception 'Student authentication required' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(response_content, ''))) not between 1 and 20000 then
    raise exception 'Submission content is invalid' using errcode = '22023';
  end if;

  select * into target_assignment from public.assignments where id = target_assignment_id;
  if not found or not exists (
    select 1 from public.enrollments
    where student_id = caller_id and course_id = target_assignment.course_id and status = 'active'
  ) then
    raise exception 'Assignment not found' using errcode = 'P0002';
  end if;

  insert into public.submissions(course_id, student_id, assignment_id, assignment_title, content, file_path)
  values (target_assignment.course_id, caller_id, target_assignment.id, target_assignment.title, left(response_content, 20000), null)
  on conflict (student_id, assignment_id) where assignment_id is not null
  do update set content = excluded.content, file_path = null, submitted_at = now(), grade = null,
    feedback = null, graded_by = null, graded_at = null
  returning id into submission_id;

  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values (caller_id, 'assignment.submit', 'submissions', submission_id, jsonb_build_object('assignment_id', target_assignment_id));
  return submission_id;
end;
$$;

revoke all on function submit_assignment(uuid, text) from public, anon;
grant execute on function submit_assignment(uuid, text) to authenticated;

create or replace function grade_assignment(target_submission_id uuid, awarded_grade numeric, marker_feedback text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_submission public.submissions%rowtype;
  maximum_points numeric;
  previous_grade numeric;
begin
  if caller_id is null or public.auth_role() not in ('lecturer', 'admin') then
    raise exception 'Faculty authentication required' using errcode = '42501';
  end if;

  select * into target_submission
  from public.submissions
  where id = target_submission_id
  for update;

  if not found or (
    public.auth_role() = 'lecturer' and not public.teaches_course(target_submission.course_id)
  ) then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  select max_points into maximum_points
  from public.assignments
  where id = target_submission.assignment_id;

  if maximum_points is null or awarded_grade < 0 or awarded_grade > maximum_points then
    raise exception 'Grade must be between 0 and the assignment maximum' using errcode = '22023';
  end if;
  if char_length(coalesce(marker_feedback, '')) > 5000 then
    raise exception 'Feedback is too long' using errcode = '22023';
  end if;

  previous_grade := target_submission.grade;
  update public.submissions
  set grade = awarded_grade,
      feedback = nullif(btrim(marker_feedback), ''),
      graded_by = caller_id,
      graded_at = now()
  where id = target_submission_id;

  insert into public.audit_log(actor_id, action, target_table, target_id, old_value, new_value)
  values (
    caller_id,
    'grade.update',
    'submissions',
    target_submission_id,
    jsonb_build_object('grade', previous_grade),
    jsonb_build_object('grade', awarded_grade)
  );
end;
$$;

revoke all on function grade_assignment(uuid, numeric, text) from public, anon;
grant execute on function grade_assignment(uuid, numeric, text) to authenticated;

-- Application decisions are committed with the student profile and audit event
-- in one transaction. Authentication invitations are compensated by the server
-- action if this function fails.
create or replace function approve_application(target_application_id uuid, invited_user_id uuid, reviewer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_record public.applications%rowtype;
begin
  select * into application_record
  from public.applications
  where id = target_application_id and status = 'pending'
  for update;
  if not found then raise exception 'Pending application not found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.profiles where id = reviewer_id and role = 'admin') then
    raise exception 'Administrator not found' using errcode = '42501';
  end if;

  insert into public.profiles(id, role, full_name, email, department_id)
  values (invited_user_id, 'student', application_record.full_name, application_record.email, application_record.department_id);
  update public.applications
  set status = 'approved', reviewed_by = reviewer_id, reviewed_at = now()
  where id = target_application_id;
  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values (reviewer_id, 'application.approve', 'applications', target_application_id, jsonb_build_object('status', 'approved', 'student_id', invited_user_id));
end;
$$;

revoke all on function approve_application(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function approve_application(uuid, uuid, uuid) to service_role;

create or replace function reject_application(target_application_id uuid, reviewer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = reviewer_id and role = 'admin') then
    raise exception 'Administrator not found' using errcode = '42501';
  end if;
  update public.applications
  set status = 'rejected', reviewed_by = reviewer_id, reviewed_at = now()
  where id = target_application_id and status = 'pending';
  if not found then raise exception 'Pending application not found' using errcode = 'P0002'; end if;
  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values (reviewer_id, 'application.reject', 'applications', target_application_id, jsonb_build_object('status', 'rejected'));
end;
$$;

revoke all on function reject_application(uuid, uuid) from public, anon, authenticated;
grant execute on function reject_application(uuid, uuid) to service_role;

create or replace function create_test_with_questions(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  course_uuid uuid := (payload->>'courseId')::uuid;
  new_test_id uuid;
  item jsonb;
  question_kind public.question_type;
  question_options jsonb;
  question_answer text;
  question_points numeric;
  position int := 0;
begin
  if caller_id is null or public.auth_role() <> 'lecturer' or not public.teaches_course(course_uuid) then
    raise exception 'Lecturer authorization required' using errcode = '42501';
  end if;
  if jsonb_typeof(payload->'questions') <> 'array' or jsonb_array_length(payload->'questions') not between 1 and 100 then
    raise exception 'Provide between 1 and 100 questions' using errcode = '22023';
  end if;

  insert into public.tests(course_id, lecturer_id, title, description, duration_minutes, passing_score, available_from, available_until, published)
  values (
    course_uuid, caller_id, left(btrim(payload->>'title'), 200), nullif(left(btrim(payload->>'description'), 2000), ''),
    (payload->>'durationMinutes')::int, (payload->>'passingScore')::numeric,
    (payload->>'availableFrom')::timestamptz, (payload->>'availableUntil')::timestamptz,
    coalesce((payload->>'published')::boolean, false)
  ) returning id into new_test_id;

  for item in select value from jsonb_array_elements(payload->'questions')
  loop
    position := position + 1;
    question_kind := (item->>'type')::public.question_type;
    question_options := case when question_kind = 'mcq' then item->'options' else null end;
    question_answer := nullif(left(btrim(item->>'correctAnswer'), 10000), '');
    question_points := (item->>'points')::numeric;
    if char_length(btrim(item->>'prompt')) < 3 or question_points <= 0 then
      raise exception 'Question % is invalid', position using errcode = '22023';
    end if;
    if question_kind in ('mcq', 'short_answer') and question_answer is null then
      raise exception 'Question % requires an answer key', position using errcode = '22023';
    end if;
    insert into public.questions(test_id, type, prompt, options, correct_answer, points, order_index)
    values (new_test_id, question_kind, left(btrim(item->>'prompt'), 10000), question_options, question_answer, question_points, position);
  end loop;

  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values (caller_id, 'test.create', 'tests', new_test_id, jsonb_build_object('question_count', position));
  return new_test_id;
end;
$$;

revoke all on function create_test_with_questions(jsonb) from public, anon;
grant execute on function create_test_with_questions(jsonb) to authenticated;
