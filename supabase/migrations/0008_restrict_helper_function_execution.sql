-- Restrict caller-scoped SECURITY DEFINER helpers to signed-in users.
-- These helpers are used by RLS/RPC logic and do not need anonymous API exposure.

revoke execute on function public.auth_role() from public, anon;
revoke execute on function public.is_enrolled(uuid) from public, anon;
revoke execute on function public.teaches_course(uuid) from public, anon;

grant execute on function public.auth_role() to authenticated;
grant execute on function public.is_enrolled(uuid) to authenticated;
grant execute on function public.teaches_course(uuid) to authenticated;
