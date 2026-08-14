-- HODs remain faculty members when they are assigned to teach a course.
drop policy if exists "lecturers read profiles of their students" on public.profiles;
create policy "faculty read profiles of their students"
  on public.profiles for select to authenticated
  using (
    (select private.auth_role()) in ('lecturer'::public.user_role, 'hod'::public.user_role)
    and exists (
      select 1 from public.enrollments e
      join public.courses c on c.id = e.course_id
      where e.student_id = profiles.id and c.lecturer_id = (select auth.uid())
    )
  );

create or replace function private.create_test_with_questions(payload jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare caller_id uuid=auth.uid(); course_uuid uuid=(payload->>'courseId')::uuid; new_test_id uuid; item jsonb; question_kind public.question_type; question_options jsonb; question_answer text; question_points numeric; position int=0;
begin
  if caller_id is null or public.auth_role() not in ('lecturer','hod') or not public.teaches_course(course_uuid) then raise exception 'Faculty authorization required' using errcode='42501'; end if;
  if jsonb_typeof(payload->'questions')<>'array' or jsonb_array_length(payload->'questions') not between 1 and 100 then raise exception 'Provide between 1 and 100 questions' using errcode='22023'; end if;
  insert into public.tests(course_id,lecturer_id,title,description,duration_minutes,passing_score,available_from,available_until,published)
  values(course_uuid,caller_id,left(btrim(payload->>'title'),200),nullif(left(btrim(payload->>'description'),2000),''),(payload->>'durationMinutes')::int,(payload->>'passingScore')::numeric,(payload->>'availableFrom')::timestamptz,(payload->>'availableUntil')::timestamptz,coalesce((payload->>'published')::boolean,false)) returning id into new_test_id;
  for item in select value from jsonb_array_elements(payload->'questions') loop
    position=position+1; question_kind=(item->>'type')::public.question_type; question_options=case when question_kind='mcq' then item->'options' else null end; question_answer=nullif(left(btrim(item->>'correctAnswer'),10000),''); question_points=(item->>'points')::numeric;
    if char_length(btrim(item->>'prompt'))<3 or question_points<=0 then raise exception 'Question % is invalid',position using errcode='22023'; end if;
    if question_kind in ('mcq','short_answer') and question_answer is null then raise exception 'Question % requires an answer key',position using errcode='22023'; end if;
    insert into public.questions(test_id,type,prompt,options,correct_answer,points,order_index) values(new_test_id,question_kind,left(btrim(item->>'prompt'),10000),question_options,question_answer,question_points,position);
  end loop;
  insert into public.audit_log(actor_id,action,target_table,target_id,new_value) values(caller_id,'test.create','tests',new_test_id,jsonb_build_object('question_count',position)); return new_test_id;
end $$;

create or replace function private.grade_assignment(target_submission_id uuid, awarded_grade numeric, marker_feedback text)
returns void
language plpgsql security definer set search_path = '' as $$
declare caller_id uuid=auth.uid(); target_submission public.submissions%rowtype; maximum_points numeric; previous_grade numeric; caller_role public.user_role;
begin
  caller_role := public.auth_role();
  if caller_id is null or caller_role not in ('lecturer','hod','admin') then raise exception 'Faculty authentication required' using errcode='42501'; end if;
  select * into target_submission from public.submissions where id=target_submission_id for update;
  if not found or (caller_role in ('lecturer','hod') and not public.teaches_course(target_submission.course_id)) then raise exception 'Submission not found' using errcode='P0002'; end if;
  select max_points into maximum_points from public.assignments where id=target_submission.assignment_id;
  if maximum_points is null or awarded_grade<0 or awarded_grade>maximum_points then raise exception 'Grade must be between 0 and the assignment maximum' using errcode='22023'; end if;
  if char_length(coalesce(marker_feedback,''))>5000 then raise exception 'Feedback is too long' using errcode='22023'; end if;
  previous_grade=target_submission.grade;
  update public.submissions set grade=awarded_grade,feedback=nullif(btrim(marker_feedback),''),graded_by=caller_id,graded_at=now() where id=target_submission_id;
  insert into public.audit_log(actor_id,action,target_table,target_id,old_value,new_value) values(caller_id,'grade.update','submissions',target_submission_id,jsonb_build_object('grade',previous_grade),jsonb_build_object('grade',awarded_grade));
end $$;
