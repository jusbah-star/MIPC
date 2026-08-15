-- Introduce first-class lessons/topics between courses and academic materials.
-- Lessons may target a whole intake (course convenor) or one class section.

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  class_section_id uuid references public.class_sections(id) on delete cascade,
  title text not null,
  description text,
  week_number integer,
  scheduled_date date,
  published boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint lessons_title_check check (char_length(btrim(title)) between 3 and 180),
  constraint lessons_description_check check (description is null or char_length(description) <= 5000),
  constraint lessons_week_number_check check (week_number is null or week_number between 1 and 60)
);

create index if not exists idx_lessons_course_scope
  on public.lessons(course_id, class_section_id, published, week_number, created_at);
create index if not exists idx_lessons_class_section
  on public.lessons(class_section_id) where class_section_id is not null;
create index if not exists idx_lessons_created_by
  on public.lessons(created_by);

alter table public.lessons enable row level security;

grant select, insert on public.lessons to authenticated;
grant all on public.lessons to service_role;

create or replace function private.enforce_lesson_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  course_department_id uuid;
  course_cohort_id uuid;
  section_department_id uuid;
  section_cohort_id uuid;
begin
  if new.class_section_id is null then
    return new;
  end if;

  select department_id, cohort_id
    into course_department_id, course_cohort_id
  from public.courses
  where id = new.course_id;

  select department_id, cohort_id
    into section_department_id, section_cohort_id
  from public.class_sections
  where id = new.class_section_id and is_active = true;

  if course_department_id is null or course_cohort_id is null
     or section_department_id is null or section_cohort_id is null
     or course_department_id <> section_department_id
     or course_cohort_id <> section_cohort_id then
    raise exception 'The class and course must belong to the same active intake' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_lesson_scope() from public, anon, authenticated;

drop trigger if exists lessons_scope_guard on public.lessons;
create trigger lessons_scope_guard
before insert or update of course_id, class_section_id on public.lessons
for each row execute function private.enforce_lesson_scope();

drop policy if exists "authorized users read lessons" on public.lessons;
create policy "authorized users read lessons"
  on public.lessons for select to authenticated
  using (
    private.can_manage_course_material(course_id, class_section_id)
    or (
      published
      and private.student_can_read_course_material(course_id, class_section_id)
    )
  );

drop policy if exists "faculty create lessons" on public.lessons;
create policy "faculty create lessons"
  on public.lessons for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.can_manage_course_material(course_id, class_section_id)
  );

alter table public.course_materials
  add column if not exists lesson_id uuid references public.lessons(id) on delete set null;

create index if not exists idx_course_materials_lesson_id
  on public.course_materials(lesson_id) where lesson_id is not null;

create or replace function private.enforce_course_material_lesson_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lesson_course_id uuid;
  lesson_class_section_id uuid;
begin
  if new.lesson_id is null then
    return new;
  end if;

  select course_id, class_section_id
    into lesson_course_id, lesson_class_section_id
  from public.lessons
  where id = new.lesson_id;

  if lesson_course_id is null
     or lesson_course_id <> new.course_id
     or lesson_class_section_id is distinct from new.class_section_id then
    raise exception 'The material must use the same course and class scope as its lesson' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_course_material_lesson_scope() from public, anon, authenticated;

drop trigger if exists course_material_lesson_scope_guard on public.course_materials;
create trigger course_material_lesson_scope_guard
before insert or update of lesson_id, course_id, class_section_id on public.course_materials
for each row execute function private.enforce_course_material_lesson_scope();

drop policy if exists "authorized users read scoped course materials" on public.course_materials;
create policy "authorized users read scoped course materials"
  on public.course_materials for select to authenticated
  using (
    private.can_manage_course_material(course_id, class_section_id)
    or (
      published
      and private.student_can_read_course_material(course_id, class_section_id)
      and (
        lesson_id is null
        or exists (
          select 1
          from public.lessons lesson_record
          where lesson_record.id = lesson_id
            and lesson_record.published = true
        )
      )
    )
  );

create or replace function public.publish_course_material_service_v2(
  publisher_id uuid,
  target_lesson_id uuid,
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
  lesson_course_id uuid;
  lesson_class_section_id uuid;
begin
  if publisher_id is null or not private.can_manage_course_material_as(publisher_id, target_course_id, target_class_section_id) then
    raise exception 'Academic material authorization required' using errcode = '42501';
  end if;

  if target_lesson_id is not null then
    select course_id, class_section_id
      into lesson_course_id, lesson_class_section_id
    from public.lessons
    where id = target_lesson_id;

    if lesson_course_id is null
       or lesson_course_id <> target_course_id
       or lesson_class_section_id is distinct from target_class_section_id then
      raise exception 'Lesson does not match the selected course and class' using errcode = '22023';
    end if;
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
    lesson_id,
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
    target_lesson_id,
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
      'lesson_id', target_lesson_id,
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

revoke all on function public.publish_course_material_service_v2(uuid, uuid, uuid, uuid, text, text, public.material_type, text, text, text, text, text, bigint, text, boolean) from public, anon, authenticated;
grant execute on function public.publish_course_material_service_v2(uuid, uuid, uuid, uuid, text, text, public.material_type, text, text, text, text, text, bigint, text, boolean) to service_role;
