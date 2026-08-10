-- =========================================================================
-- 0001_init_schema.sql
-- Core relational schema for the College Management + Learning Management
-- System. Run via `supabase db push` or the Supabase SQL editor.
-- =========================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- -------------------------------------------------------------------------
-- Org structure
-- -------------------------------------------------------------------------

create table departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null unique,
  created_at  timestamptz not null default now()
);

create table cohorts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,               -- e.g. "BSc CS 2026"
  department_id   uuid not null references departments(id) on delete cascade,
  start_date      date not null,
  end_date        date,
  created_at      timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- People. profiles.id == auth.users.id (1:1). Role lives here, not in
-- auth metadata, so it can be referenced by RLS policies and joins.
-- -------------------------------------------------------------------------

create type user_role as enum ('student', 'lecturer', 'admin');

create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            user_role not null default 'student',
  full_name       text not null,
  email           text not null,
  department_id   uuid references departments(id) on delete set null,
  cohort_id       uuid references cohorts(id) on delete set null, -- students only
  created_at      timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- Courses & enrollment
-- -------------------------------------------------------------------------

create table courses (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,          -- e.g. "CS201"
  title           text not null,
  description     text,
  department_id   uuid not null references departments(id) on delete cascade,
  cohort_id       uuid references cohorts(id) on delete set null,
  lecturer_id     uuid references profiles(id) on delete set null,
  credits         int not null default 3,
  created_at      timestamptz not null default now()
);

create type enrollment_status as enum ('active', 'dropped', 'completed');

create table enrollments (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references profiles(id) on delete cascade,
  course_id       uuid not null references courses(id) on delete cascade,
  status          enrollment_status not null default 'active',
  enrolled_at     timestamptz not null default now(),
  unique (student_id, course_id)
);

-- -------------------------------------------------------------------------
-- Admissions pipeline (public-facing)
-- -------------------------------------------------------------------------

create type application_status as enum ('pending', 'under_review', 'approved', 'rejected');

create table applications (
  id                uuid primary key default gen_random_uuid(),
  full_name         text not null,
  email             text not null,
  phone             text,
  department_id     uuid references departments(id) on delete set null,
  status            application_status not null default 'pending',
  documents_path    text,                 -- storage bucket path, prefix per application id
  submitted_at      timestamptz not null default now(),
  reviewed_by        uuid references profiles(id) on delete set null,
  reviewed_at        timestamptz
);

-- -------------------------------------------------------------------------
-- Announcements. One table, scoped, instead of three parallel systems.
-- -------------------------------------------------------------------------

create type announcement_scope as enum ('public', 'college', 'course');

create table announcements (
  id            uuid primary key default gen_random_uuid(),
  scope         announcement_scope not null,
  course_id     uuid references courses(id) on delete cascade, -- required iff scope = 'course'
  title         text not null,
  body          text not null,
  author_id     uuid not null references profiles(id) on delete set null,
  published_at  timestamptz not null default now(),
  constraint course_scope_requires_course
    check (scope <> 'course' or course_id is not null)
);

-- -------------------------------------------------------------------------
-- Tests. Timing is authoritative on test_attempts, never trusted from
-- the client. See src/app/api/tests/[testId]/{attempt,submit}/route.ts.
-- -------------------------------------------------------------------------

create table tests (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references courses(id) on delete cascade,
  lecturer_id       uuid not null references profiles(id) on delete cascade,
  title             text not null,
  description       text,
  duration_minutes  int not null,
  available_from    timestamptz not null,
  available_until   timestamptz not null,
  published         boolean not null default false,
  created_at        timestamptz not null default now(),
  constraint window_is_valid check (available_until > available_from)
);

create type question_type as enum ('mcq', 'short_answer', 'essay');

create table questions (
  id              uuid primary key default gen_random_uuid(),
  test_id         uuid not null references tests(id) on delete cascade,
  type            question_type not null,
  prompt          text not null,
  options         jsonb,               -- for mcq: [{ "id": "a", "label": "..." }, ...]
  correct_answer  text,                -- for mcq/short_answer auto-grading; null for essay
  points          numeric not null default 1,
  order_index     int not null default 0
);

create type attempt_status as enum ('in_progress', 'submitted', 'auto_submitted');

create table test_attempts (
  id              uuid primary key default gen_random_uuid(),
  test_id         uuid not null references tests(id) on delete cascade,
  student_id      uuid not null references profiles(id) on delete cascade,
  started_at      timestamptz not null default now(),
  expires_at      timestamptz not null,   -- started_at + test.duration_minutes, set server-side
  submitted_at    timestamptz,
  status          attempt_status not null default 'in_progress',
  score           numeric,
  unique (test_id, student_id)            -- one attempt per student per test
);

create table answers (
  id            uuid primary key default gen_random_uuid(),
  attempt_id    uuid not null references test_attempts(id) on delete cascade,
  question_id   uuid not null references questions(id) on delete cascade,
  response      text,
  points_awarded numeric,
  unique (attempt_id, question_id)
);

-- -------------------------------------------------------------------------
-- Assignment submissions (separate from timed-test data)
-- -------------------------------------------------------------------------

create table submissions (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references courses(id) on delete cascade,
  student_id        uuid not null references profiles(id) on delete cascade,
  assignment_title  text not null,
  file_path         text not null,      -- Supabase Storage object path
  submitted_at      timestamptz not null default now(),
  grade             numeric,
  feedback          text,
  graded_by         uuid references profiles(id) on delete set null,
  graded_at         timestamptz
);

-- -------------------------------------------------------------------------
-- Audit log. Cheap now, invaluable the first time a grade is disputed.
-- -------------------------------------------------------------------------

create table audit_log (
  id            bigint generated always as identity primary key,
  actor_id      uuid references profiles(id) on delete set null,
  action        text not null,          -- e.g. 'grade.update', 'application.approve'
  target_table  text not null,
  target_id     uuid not null,
  old_value     jsonb,
  new_value     jsonb,
  created_at    timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- Indexes for the access patterns RLS + app queries will hit constantly
-- -------------------------------------------------------------------------

create index on profiles (role);
create index on enrollments (student_id);
create index on enrollments (course_id);
create index on courses (lecturer_id);
create index on announcements (scope, course_id);
create index on tests (course_id);
create index on test_attempts (student_id);
create index on submissions (course_id, student_id);
