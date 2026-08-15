-- Harden academic material publication so privileged writes are performed only
-- by the server-side service role. The authenticated browser/API session is
-- still verified in the application before this RPC is called.

create or replace function private.can_manage_course_material_as(
  target_actor_id uuid,
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
    where actor.id = target_actor_id
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

revoke all on function private.can_manage_course_material_as(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function private.can_manage_course_material_as(uuid, uuid, uuid) to service_role;

create or replace function private.can_manage_course_material(
  target_course_id uuid,
  target_class_section_id uuid default null
) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.can_manage_course_material_as(
    (select auth.uid()),
    target_course_id,
    target_class_section_id
  )
$$;

revoke all on function private.can_manage_course_material(uuid, uuid) from public, anon;
grant execute on function private.can_manage_course_material(uuid, uuid) to authenticated, service_role;

create or replace function public.publish_course_material_service(
  publisher_id uuid,
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
  material_id uuid;
begin
  if publisher_id is null or not private.can_manage_course_material_as(publisher_id, target_course_id, target_class_section_id) then
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
    if file_storage_path !~ ('^' || publisher_id::text || '/' || target_course_id::text || '/[0-9a-fA-F-]+\.[A-Za-z0-9]+$')
       or file_storage_path ~ '(^|/)\.\.(/|$)' then
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
    publisher_id
  ) returning id into material_id;

  insert into public.audit_log(actor_id, action, target_table, target_id, new_value)
  values (
    publisher_id,
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

revoke all on function public.publish_course_material_service(uuid, uuid, uuid, text, text, public.material_type, text, text, text, text, text, bigint, text, boolean) from public, anon, authenticated;
grant execute on function public.publish_course_material_service(uuid, uuid, uuid, text, text, public.material_type, text, text, text, text, text, bigint, text, boolean) to service_role;
