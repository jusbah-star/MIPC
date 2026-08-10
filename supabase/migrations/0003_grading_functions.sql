-- =========================================================================
-- 0003_grading_functions.sql
-- Auto-grading and auto-expiry for test_attempts. These run with elevated
-- privilege (security definer) because a student's own RLS grant on
-- test_attempts/answers is intentionally narrow.
-- =========================================================================

-- Scores one attempt: auto-gradable question types (mcq, short_answer)
-- compare the trimmed, case-insensitive response against correct_answer;
-- essay questions are left ungraded (points_awarded null) for manual
-- lecturer review. Safe to call multiple times — it's idempotent.
create or replace function grade_attempt(target_attempt_id uuid) returns numeric as $$
declare
  total_score numeric;
begin
  update answers a
  set points_awarded = case
    when q.type in ('mcq', 'short_answer')
      then case
        when lower(trim(a.response)) = lower(trim(q.correct_answer)) then q.points
        else 0
      end
    else a.points_awarded -- essay: leave whatever a lecturer has already entered
  end
  from questions q
  where q.id = a.question_id and a.attempt_id = target_attempt_id;

  select sum(points_awarded) into total_score
  from answers where attempt_id = target_attempt_id;

  update test_attempts set score = total_score where id = target_attempt_id;
  return total_score;
end;
$$ language plpgsql security definer set search_path = public;

-- Closes out any attempt whose deadline has passed while still
-- 'in_progress' (student closed the tab, lost connection, etc). Schedule
-- this to run every minute — either Postgres's pg_cron extension:
--
--   select cron.schedule('finalize-test-attempts', '* * * * *',
--     $$select finalize_expired_attempts()$$);
--
-- or a Supabase Edge Function on a cron trigger if pg_cron isn't
-- available on your plan. Either way, the /api/tests/[testId]/submit
-- route (src/app/api/tests/[testId]/submit/route.ts) enforces the same
-- deadline synchronously, so grading correctness never depends on this
-- job's schedule — it's just cleanup for attempts nobody submitted.
create or replace function finalize_expired_attempts() returns void as $$
declare
  expired record;
begin
  for expired in
    select id from test_attempts
    where status = 'in_progress' and expires_at < now()
  loop
    update test_attempts
    set status = 'auto_submitted', submitted_at = now()
    where id = expired.id;

    perform grade_attempt(expired.id);
  end loop;
end;
$$ language plpgsql security definer set search_path = public;
