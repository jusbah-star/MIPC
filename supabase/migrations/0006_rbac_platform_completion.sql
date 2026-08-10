-- =========================================================================
-- 0006_rbac_platform_completion.sql
-- Completes the role capability matrix: account suspension, course materials,
-- registrar user controls, and high-volume academic query indexes.
-- =========================================================================

create type account_status as enum ('active', 'suspended');
create type material_type as enum ('document', 'link', 'note');

alter table profiles
  add column account_status account_status not null default 'active';

create table course_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 180),
  description text check (char_length(description) <= 3000),
  material_type material_type not null default 'note',
  resource_url text,
  content text check (char_length(content) <= 20000),
  published boolean not null default false,
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_material_has_content check (
    nullif(btrim(coalesce(resource_url, '')), '') is not null
    or nullif(btrim(coalesce(content, '')), '') is not null
  ),
  constraint course_material_url_protocol check (
    resource_url is null or resource_url ~ '^https://'
  )
);

alter table course_materials enable row level security;

-- Suspended accounts resolve to no application role. Helper functions also
-- include active-account checks so old sessions cannot retain course access.
create or replace function auth_role() returns user_role
language sql stable security definer
set search_path = ''
as $$
  select role from public.profiles
  where id = (select auth.uid()) and account_status = 'active'
$$;

create or replace function teaches_course(target_course_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.courses c
    join public.profiles p on p.id = (select auth.uid())
    where c.id = target_course_id
      and c.lecturer_id = (select auth.uid())
      and p.account_status = 'active'
  )
$$;

create or replace function is_enrolled(target_course_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.profiles p on p.id = e.student_id
    where e.course_id = target_course_id
      and e.student_id = (select auth.uid())
      and e.status = 'active'
      and p.account_status = 'active'
  )
$$;

create policy "students read published course materials"
  on course_materials for select to authenticated
  using (published and is_enrolled(course_id));

create policy "lecturers manage course materials"
  on course_materials for all to authenticated
  using (teaches_course(course_id))
  with check (teaches_course(course_id) and created_by = (select auth.uid()));

create policy "admins manage course materials"
  on course_materials for all to authenticated
  using ((select auth_role()) = 'admin')
  with check ((select auth_role()) = 'admin');

drop policy if exists "college announcements readable by authenticated users" on announcements;
create policy "college announcements readable by active users"
  on announcements for select to authenticated
  using (scope = 'college' and (select auth_role()) is not null);

-- Service-only registrar mutation. This keeps role/status changes and their
-- audit event atomic, and prevents an administrator from locking themselves out.
create or replace function admin_update_user(
  target_user_id uuid,
  new_role user_role,
  new_status account_status,
  reviewer_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous public.profiles%rowtype;
begin
  if not exists (
    select 1 from public.profiles
    where id = reviewer_id and role = 'admin' and account_status = 'active'
  ) then
    raise exception 'Administrator authorization required' using errcode = '42501';
  end if;

  select * into previous from public.profiles where id = target_user_id for update;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;

  if target_user_id = reviewer_id and (new_role <> 'admin' or new_status <> 'active') then
    raise exception 'Administrators cannot remove or suspend their own access' using errcode = '22023';
  end if;

  if previous.role = 'admin' and previous.account_status = 'active'
     and (new_role <> 'admin' or new_status <> 'active')
     and (select count(*) from public.profiles where role = 'admin' and account_status = 'active') <= 1 then
    raise exception 'At least one active administrator is required' using errcode = '22023';
  end if;

  update public.profiles
  set role = new_role, account_status = new_status
  where id = target_user_id;

  insert into public.audit_log(actor_id, action, target_table, target_id, old_value, new_value)
  values (
    reviewer_id,
    'user.access.update',
    'profiles',
    target_user_id,
    jsonb_build_object('role', previous.role, 'account_status', previous.account_status),
    jsonb_build_object('role', new_role, 'account_status', new_status)
  );
end;
$$;

revoke all on function admin_update_user(uuid, user_role, account_status, uuid) from public, anon, authenticated;
grant execute on function admin_update_user(uuid, user_role, account_status, uuid) to service_role;

create or replace function publish_course_material(
  target_course_id uuid,
  material_title text,
  material_description text,
  material_kind material_type,
  material_url text,
  material_content text,
  publish_now boolean
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  material_id uuid;
begin
  if caller_id is null or not public.teaches_course(target_course_id) then
    raise exception 'Lecturer authorization required' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(material_title, ''))) not between 3 and 180 then
    raise exception 'Material title is invalid' using errcode = '22023';
  end if;
  if material_url is not null and material_url !~ '^https://' then
    raise exception 'Resource links must use HTTPS' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(material_url, '')), '') is null
     and nullif(btrim(coalesce(material_content, '')), '') is null then
    raise exception 'Material content or resource link is required' using errcode = '22023';
  end if;

  insert into public.course_materials(
    course_id, title, description, material_type, resource_url, content, published, created_by
  ) values (
    target_course_id,
    left(btrim(material_title), 180),
    nullif(left(btrim(coalesce(material_description, '')), 3000), ''),
    material_kind,
    nullif(left(btrim(coalesce(material_url, '')), 2000), ''),
    nullif(left(btrim(coalesce(material_content, '')), 20000), ''),
    publish_now,
    caller_id
  ) returning id into material_id;

  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values (caller_id, 'course.material.publish', 'course_materials', material_id,
    jsonb_build_object('course_id', target_course_id, 'published', publish_now));
  return material_id;
end;
$$;

revoke all on function publish_course_material(uuid, text, text, material_type, text, text, boolean) from public, anon;
grant execute on function publish_course_material(uuid, text, text, material_type, text, text, boolean) to authenticated;

create or replace function publish_global_announcement(
  announcement_kind announcement_scope,
  announcement_title text,
  announcement_body text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  announcement_id uuid;
begin
  if caller_id is null or public.auth_role() <> 'admin' then
    raise exception 'Administrator authorization required' using errcode = '42501';
  end if;
  if announcement_kind not in ('public', 'college') then
    raise exception 'Global announcements must be public or college scoped' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(announcement_title, ''))) not between 4 and 180
     or char_length(btrim(coalesce(announcement_body, ''))) not between 10 and 5000 then
    raise exception 'Announcement content is invalid' using errcode = '22023';
  end if;

  insert into public.announcements(scope, course_id, title, body, author_id)
  values (announcement_kind, null, left(btrim(announcement_title), 180), left(btrim(announcement_body), 5000), caller_id)
  returning id into announcement_id;
  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values (caller_id, 'announcement.publish', 'announcements', announcement_id,
    jsonb_build_object('scope', announcement_kind));
  return announcement_id;
end;
$$;

revoke all on function publish_global_announcement(announcement_scope, text, text) from public, anon;
grant execute on function publish_global_announcement(announcement_scope, text, text) to authenticated;

-- Index the exact filters used during simultaneous exam, dashboard, material,
-- announcement, and grading workloads.
create index if not exists idx_tests_course_published_window
  on tests(course_id, published, available_from, available_until);
create index if not exists idx_attempts_test_student_status
  on test_attempts(test_id, student_id, status);
create index if not exists idx_assignments_course_due
  on assignments(course_id, due_date);
create index if not exists idx_submissions_course_grade_submitted
  on submissions(course_id, grade, submitted_at desc);
create index if not exists idx_announcements_course_published
  on announcements(course_id, published_at desc);
create index if not exists idx_materials_course_published_created
  on course_materials(course_id, published, created_at desc);
create index if not exists idx_profiles_role_status
  on profiles(role, account_status);
