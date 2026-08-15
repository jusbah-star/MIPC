-- Secure file-backed lesson/course materials for lecturers, HODs and students.
-- Files live in a private Supabase Storage bucket; database rows carry scope
-- and metadata while downloads are issued through short-lived signed URLs.

alter table public.course_materials
  add column if not exists class_section_id uuid references public.class_sections(id) on delete cascade,
  add column if not exists material_category text not null default 'other',
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists mime_type text;

alter table public.course_materials
  drop constraint if exists course_material_has_content,
  add constraint course_material_has_content check (
    nullif(btrim(coalesce(resource_url, '')), '') is not null
    or nullif(btrim(coalesce(content, '')), '') is not null
    or nullif(btrim(coalesce(storage_path, '')), '') is not null
  ),
  drop constraint if exists course_material_category_check,
  add constraint course_material_category_check check (
    material_category in ('book','handout','questionnaire','assignment','past_paper','presentation','worksheet','reference','other')
  ),
  drop constraint if exists course_material_storage_path_check,
  add constraint course_material_storage_path_check check (
    storage_path is null or (char_length(storage_path) between 3 and 1000 and storage_path !~ '(^|/)\.\.(/|$)')
  ),
  drop constraint if exists course_material_file_name_check,
  add constraint course_material_file_name_check check (
    file_name is null or char_length(btrim(file_name)) between 1 and 255
  ),
  drop constraint if exists course_material_file_size_check,
  add constraint course_material_file_size_check check (
    file_size is null or file_size between 1 and 26214400
  ),
  drop constraint if exists course_material_file_metadata_check,
  add constraint course_material_file_metadata_check check (
    (storage_path is null and file_name is null and file_size is null and mime_type is null)
    or (storage_path is not null and file_name is not null and file_size is not null and mime_type is not null)
  );

create index if not exists idx_course_materials_class_scope
  on public.course_materials(course_id, class_section_id, published, created_at desc);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-materials',
  'course-materials',
  false,
  26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/jpeg',
    'image/png'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_manage_course_material(
  target_course_id uuid,
  target_class_section_id uuid default null
) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles actor
    join public.courses course_record on course_record.id = target_course_id
    left join public.class_sections section_record on section_record.id = target_class_section_id
    where actor.id = (select auth.uid())
      and actor.account_status = 'active'
      and (
        actor.role = 'admin'
        or (
          target_class_section_id is null
          and course_record.lecturer_id = actor.id
          and actor.role in ('lecturer','hod')
        )
        or (
          target_class_section_id is not null
          and section_record.id is not null
          and section_record.department_id = course_record.department_id
          and section_record.cohort_id = course_record.cohort_id
          and (
            course_record.lecturer_id = actor.id
            or (actor.role = 'hod' and actor.department_id = course_record.department_id)
            or exists (
              select 1
              from public.course_class_assignments cca
              where cca.course_id = target_course_id
                and cca.class_section_id = target_class_section_id
                and cca.lecturer_id = actor.id
            )
          )
        )
      )
  )
$$;

create or replace function private.student_can_read_course_material(
  target_course_id uuid,
  target_class_section_id uuid default null
) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles student
    join public.enrollments e on e.student_id = student.id
    where student.id = (select auth.uid())
      and student.role = 'student'
      and student.account_status = 'active'
      and e.course_id = target_course_id
      and e.status = 'active'
      and (target_class_section_id is null or student.class_section_id = target_class_section_id)
  )
$$;

revoke all on function private.can_manage_course_material(uuid, uuid) from public, anon;
revoke all on function private.student_can_read_course_material(uuid, uuid) from public, anon;
grant execute on function private.can_manage_course_material(uuid, uuid) to authenticated, service_role;
grant execute on function private.student_can_read_course_material(uuid, uuid) to authenticated, service_role;

drop policy if exists "students read published course materials" on public.course_materials;
drop policy if exists "lecturers manage course materials" on public.course_materials;
drop policy if exists "admins manage course materials" on public.course_materials;
drop policy if exists "faculty manage scoped course materials" on public.course_materials;

create policy "students read published scoped course materials"
  on public.course_materials for select to authenticated
  using (
    published
    and private.student_can_read_course_material(course_id, class_section_id)
  );

create policy "faculty manage scoped course materials"
  on public.course_materials for all to authenticated
  using (private.can_manage_course_material(course_id, class_section_id))
  with check (
    private.can_manage_course_material(course_id, class_section_id)
    and created_by = (select auth.uid())
  );

create or replace function public.publish_course_material_v2(
  target_course_id uuid,
  target_class_section_id uuid,
  material_title text,
  material_description text,
  material_kind public.material_type,
  material_category_name text,
  material_url text,
  material_content text,
  file_storage_path text,
  original_file_name text,
  original_file_size bigint,
  original_mime_type text,
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
  if caller_id is null or not private.can_manage_course_material(target_course_id, target_class_section_id) then
    raise exception 'Academic material authorization required' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(material_title, ''))) not between 3 and 180 then
    raise exception 'Material title is invalid' using errcode = '22023';
  end if;

  if material_category_name not in ('book','handout','questionnaire','assignment','past_paper','presentation','worksheet','reference','other') then
    raise exception 'Material category is invalid' using errcode = '22023';
  end if;

  if material_url is not null and material_url !~ '^https://' then
    raise exception 'Resource links must use HTTPS' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(material_url, '')), '') is null
     and nullif(btrim(coalesce(material_content, '')), '') is null
     and nullif(btrim(coalesce(file_storage_path, '')), '') is null then
    raise exception 'A file, material content, or resource link is required' using errcode = '22023';
  end if;

  if file_storage_path is not null then
    if original_file_name is null or original_file_size is null or original_mime_type is null then
      raise exception 'File metadata is incomplete' using errcode = '22023';
    end if;
    if original_file_size < 1 or original_file_size > 26214400 then
      raise exception 'Academic files must be 25 MB or smaller' using errcode = '22023';
    end if;
    if file_storage_path ~ '(^|/)\.\.(/|$)' then
      raise exception 'Storage path is invalid' using errcode = '22023';
    end if;
  end if;

  insert into public.course_materials(
    course_id,
    class_section_id,
    title,
    description,
    material_type,
    material_category,
    resource_url,
    content,
    storage_path,
    file_name,
    file_size,
    mime_type,
    published,
    created_by
  ) values (
    target_course_id,
    target_class_section_id,
    left(btrim(material_title), 180),
    nullif(left(btrim(coalesce(material_description, '')), 3000), ''),
    material_kind,
    material_category_name,
    nullif(left(btrim(coalesce(material_url, '')), 2000), ''),
    nullif(left(btrim(coalesce(material_content, '')), 20000), ''),
    nullif(left(btrim(coalesce(file_storage_path, '')), 1000), ''),
    nullif(left(btrim(coalesce(original_file_name, '')), 255), ''),
    original_file_size,
    nullif(left(btrim(coalesce(original_mime_type, '')), 180), ''),
    publish_now,
    caller_id
  ) returning id into material_id;

  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values (
    caller_id,
    'course.material.publish',
    'course_materials',
    material_id,
    jsonb_build_object(
      'course_id', target_course_id,
      'class_section_id', target_class_section_id,
      'category', material_category_name,
      'file_name', original_file_name,
      'published', publish_now
    )
  );

  return material_id;
end;
$$;

revoke all on function public.publish_course_material_v2(uuid, uuid, text, text, public.material_type, text, text, text, text, text, bigint, text, boolean) from public, anon;
grant execute on function public.publish_course_material_v2(uuid, uuid, text, text, public.material_type, text, text, text, text, text, bigint, text, boolean) to authenticated;
