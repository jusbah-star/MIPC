-- =========================================================================
-- 0004_extended_features_and_indexes.sql
-- Missing performance indexes, assignments system, and schema extensions.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Performance & Query Indexes
-- -------------------------------------------------------------------------

create index if not exists idx_questions_test_id on questions(test_id);
create index if not exists idx_test_attempts_status_expires on test_attempts(status, expires_at);
create index if not exists idx_applications_status_submitted on applications(status, submitted_at);
create index if not exists idx_courses_department_id on courses(department_id);
create index if not exists idx_courses_cohort_id on courses(cohort_id);
create index if not exists idx_profiles_cohort_id on profiles(cohort_id);
create index if not exists idx_profiles_department_id on profiles(department_id);
create index if not exists idx_answers_attempt_id on answers(attempt_id);

-- -------------------------------------------------------------------------
-- 2. Formal Assignments Table
-- -------------------------------------------------------------------------

create table if not exists assignments (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references courses(id) on delete cascade,
  title           text not null,
  description     text,
  due_date        timestamptz not null,
  max_points      numeric not null default 100,
  created_at      timestamptz not null default now()
);

create index if not exists idx_assignments_course_id on assignments(course_id);

alter table assignments enable row level security;

-- Policies for assignments
create policy "assignments readable by enrolled or teaching users"
  on assignments for select using (
    is_enrolled(course_id) or teaches_course(course_id) or auth_role() = 'admin'
  );

create policy "lecturers manage own course assignments"
  on assignments for all using (
    teaches_course(course_id) or auth_role() = 'admin'
  );

-- Link submissions to assignments (optional reference for backwards compatibility)
alter table submissions add column if not exists assignment_id uuid references assignments(id) on delete cascade;
create index if not exists idx_submissions_assignment_id on submissions(assignment_id);

-- -------------------------------------------------------------------------
-- 3. Seed Reference Data (Departments, Sample Cohorts)
-- -------------------------------------------------------------------------

insert into departments (id, name, code) values
  ('d1000000-0000-0000-0000-000000000001', 'Computer Science & Engineering', 'CSE'),
  ('d1000000-0000-0000-0000-000000000002', 'Mathematical Sciences', 'MATH'),
  ('d1000000-0000-0000-0000-000000000003', 'Natural Sciences & Physics', 'PHYS'),
  ('d1000000-0000-0000-0000-000000000004', 'Humanities & Classical Studies', 'HUM')
on conflict (code) do nothing;

insert into cohorts (id, name, department_id, start_date, end_date) values
  ('c1000000-0000-0000-0000-000000000001', 'Class of 2026 (CS)', 'd1000000-0000-0000-0000-000000000001', '2022-09-01', '2026-06-30'),
  ('c1000000-0000-0000-0000-000000000002', 'Class of 2027 (CS)', 'd1000000-0000-0000-0000-000000000001', '2023-09-01', '2027-06-30'),
  ('c1000000-0000-0000-0000-000000000003', 'Class of 2026 (Math)', 'd1000000-0000-0000-0000-000000000002', '2022-09-01', '2026-06-30')
on conflict do nothing;
