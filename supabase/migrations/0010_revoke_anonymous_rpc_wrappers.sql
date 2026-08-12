-- Explicitly remove PostgreSQL's implicit PUBLIC execute grant from API wrappers.
-- Authenticated and service-role execution remains intentionally granted.

revoke execute on function public.auth_role() from PUBLIC, anon;
revoke execute on function public.is_enrolled(uuid) from PUBLIC, anon;
revoke execute on function public.teaches_course(uuid) from PUBLIC, anon;
revoke execute on function public.create_test_with_questions(jsonb) from PUBLIC, anon;
revoke execute on function public.get_student_questions(uuid) from PUBLIC, anon;
revoke execute on function public.grade_assignment(uuid, numeric, text) from PUBLIC, anon;
revoke execute on function public.publish_course_material(uuid, text, text, public.material_type, text, text, boolean) from PUBLIC, anon;
revoke execute on function public.publish_global_announcement(public.announcement_scope, text, text) from PUBLIC, anon;
revoke execute on function public.save_test_answers(uuid, jsonb) from PUBLIC, anon;
revoke execute on function public.start_test_attempt(uuid) from PUBLIC, anon;
revoke execute on function public.submit_assignment(uuid, text) from PUBLIC, anon;
revoke execute on function public.submit_test_attempt(uuid, jsonb) from PUBLIC, anon;

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
