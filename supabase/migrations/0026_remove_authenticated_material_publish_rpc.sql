-- Remove the temporary authenticated SECURITY DEFINER publisher introduced in
-- 0024. The application now publishes through publish_course_material_service,
-- which is executable only by the server-side service role.

revoke all on function public.publish_course_material_v2(
  uuid,
  uuid,
  text,
  text,
  public.material_type,
  text,
  text,
  text,
  text,
  text,
  bigint,
  text,
  boolean
) from public, anon, authenticated;

drop function if exists public.publish_course_material_v2(
  uuid,
  uuid,
  text,
  text,
  public.material_type,
  text,
  text,
  text,
  text,
  text,
  bigint,
  text,
  boolean
);
