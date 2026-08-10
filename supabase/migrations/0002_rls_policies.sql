-- =========================================================================
-- 0002_rls_policies.sql
-- Row Level Security. Every table a role shouldn't fully see gets locked
-- down here — this is the actual enforcement layer, not the Next.js app.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Helper functions. security definer so they can read `profiles` even
-- when the calling role's own RLS would otherwise block that read.
-- -------------------------------------------------------------------------

create or replace function auth_role() returns user_role as $$
  select role from profiles where id = auth.uid()
$$ language sql stable security definer set search_path = public;

create or replace function teaches_course(target_course_id uuid) returns boolean as $$
  select exists (
    select 1 from courses
    where id = target_course_id and lecturer_id = auth.uid()
  )
$$ language sql stable security definer set search_path = public;

create or replace function is_enrolled(target_course_id uuid) returns boolean as $$
  select exists (
    select 1 from enrollments
    where course_id = target_course_id
      and student_id = auth.uid()
      and status = 'active'
  )
$$ language sql stable security definer set search_path = public;

-- Enable RLS everywhere. Nothing is readable/writable until a policy says so.
alter table departments    enable row level security;
alter table cohorts        enable row level security;
alter table profiles       enable row level security;
alter table courses        enable row level security;
alter table enrollments    enable row level security;
alter table applications   enable row level security;
alter table announcements  enable row level security;
alter table tests          enable row level security;
alter table questions      enable row level security;
alter table test_attempts  enable row level security;
alter table answers        enable row level security;
alter table submissions    enable row level security;
alter table audit_log      enable row level security;

-- -------------------------------------------------------------------------
-- departments / cohorts — low-sensitivity reference data, readable by any
-- authenticated user; only admins write.
-- -------------------------------------------------------------------------

create policy "departments readable by authenticated users"
  on departments for select using (auth.role() = 'authenticated');
create policy "departments writable by admin"
  on departments for all using (auth_role() = 'admin');

create policy "cohorts readable by authenticated users"
  on cohorts for select using (auth.role() = 'authenticated');
create policy "cohorts writable by admin"
  on cohorts for all using (auth_role() = 'admin');

-- -------------------------------------------------------------------------
-- profiles — you can read your own row and any lecturer/admin can read
-- profiles in courses/cohorts they're tied to; only admins edit roles.
-- Security fix: with check clause enforces role immutability for non-admins.
-- -------------------------------------------------------------------------

create policy "read own profile"
  on profiles for select using (id = auth.uid());
create policy "admins read all profiles"
  on profiles for select using (auth_role() = 'admin');
create policy "lecturers read profiles of their students"
  on profiles for select using (
    auth_role() = 'lecturer'
    and exists (
      select 1 from enrollments e join courses c on c.id = e.course_id
      where e.student_id = profiles.id and c.lecturer_id = auth.uid()
    )
  );
create policy "users update own non-role fields"
  on profiles for update 
  using (id = auth.uid())
  with check (
    id = auth.uid() 
    and role = (select role from profiles where id = auth.uid())
  );
create policy "admins manage all profiles"
  on profiles for all using (auth_role() = 'admin');

-- -------------------------------------------------------------------------
-- courses — public metadata is visible to everyone (for the course
-- catalog); enrollment-gated detail is handled at the query/page level.
-- -------------------------------------------------------------------------

create policy "courses readable by authenticated users"
  on courses for select using (auth.role() = 'authenticated');
create policy "lecturers manage own courses"
  on courses for update using (lecturer_id = auth.uid());
create policy "admins manage all courses"
  on courses for all using (auth_role() = 'admin');

-- -------------------------------------------------------------------------
-- enrollments
-- -------------------------------------------------------------------------

create policy "students read own enrollments"
  on enrollments for select using (student_id = auth.uid());
create policy "lecturers read enrollments in their courses"
  on enrollments for select using (teaches_course(course_id));
create policy "admins manage enrollments"
  on enrollments for all using (auth_role() = 'admin');

-- -------------------------------------------------------------------------
-- applications — applicants are anonymous/public inserts (admissions
-- form); only admins can read or update the pipeline.
-- -------------------------------------------------------------------------

create policy "anyone can submit an application"
  on applications for insert with check (true);
create policy "admins manage applications"
  on applications for all using (auth_role() = 'admin');

-- -------------------------------------------------------------------------
-- announcements — scope decides visibility.
-- -------------------------------------------------------------------------

create policy "public announcements readable by anyone"
  on announcements for select using (scope = 'public');
create policy "college announcements readable by authenticated users"
  on announcements for select using (scope = 'college' and auth.role() = 'authenticated');
create policy "course announcements readable by enrolled/teaching users"
  on announcements for select using (
    scope = 'course'
    and (is_enrolled(course_id) or teaches_course(course_id) or auth_role() = 'admin')
  );
create policy "lecturers publish course announcements"
  on announcements for insert with check (
    scope = 'course' and teaches_course(course_id) and author_id = auth.uid()
  );
create policy "admins publish any announcement"
  on announcements for all using (auth_role() = 'admin');

-- -------------------------------------------------------------------------
-- tests / questions — students only ever see published tests in courses
-- they're enrolled in.
-- Security fix: students cannot read base questions table directly (which
-- would leak correct_answer). They read via questions_for_student view.
-- -------------------------------------------------------------------------

create policy "students read published tests in enrolled courses"
  on tests for select using (published = true and is_enrolled(course_id));
create policy "lecturers manage own tests"
  on tests for all using (teaches_course(course_id));
create policy "admins read all tests"
  on tests for select using (auth_role() = 'admin');

create policy "lecturers manage questions on own tests"
  on questions for all using (
    exists (select 1 from tests t where t.id = questions.test_id and teaches_course(t.course_id))
  );
create policy "admins manage all questions"
  on questions for all using (auth_role() = 'admin');

-- Students must never read `correct_answer` directly. Expose an
-- answer-key-stripped view for student test-taking.
create or replace view questions_for_student as
  select id, test_id, type, prompt, options, points, order_index
  from questions;

-- -------------------------------------------------------------------------
-- test_attempts / answers
-- Security fix: answers can only be inserted/updated while attempt is in_progress
-- and before expires_at.
-- -------------------------------------------------------------------------

create policy "students manage own attempts"
  on test_attempts for all using (student_id = auth.uid());
create policy "lecturers read attempts on their tests"
  on test_attempts for select using (
    exists (select 1 from tests t where t.id = test_attempts.test_id and teaches_course(t.course_id))
  );

create policy "students manage own answers while in progress"
  on answers for all using (
    exists (
      select 1 from test_attempts a 
      where a.id = answers.attempt_id 
        and a.student_id = auth.uid()
        and a.status = 'in_progress'
        and a.expires_at > now()
    )
  );
create policy "lecturers read answers on their tests"
  on answers for select using (
    exists (
      select 1 from test_attempts a
      join tests t on t.id = a.test_id
      where a.id = answers.attempt_id and teaches_course(t.course_id)
    )
  );

-- -------------------------------------------------------------------------
-- submissions
-- -------------------------------------------------------------------------

create policy "students manage own submissions"
  on submissions for all using (student_id = auth.uid());
create policy "lecturers read and grade submissions in their courses"
  on submissions for all using (teaches_course(course_id));

-- -------------------------------------------------------------------------
-- audit_log — write-only for the app (via server-side service calls),
-- readable only by admins.
-- -------------------------------------------------------------------------

create policy "admins read audit log"
  on audit_log for select using (auth_role() = 'admin');
create policy "authenticated users can write audit entries"
  on audit_log for insert with check (auth.role() = 'authenticated');
