-- Keep class-scoped material reads efficient and avoid multiple permissive
-- SELECT policies being evaluated for every course_materials row.

create index if not exists idx_course_materials_class_section
  on public.course_materials(class_section_id)
  where class_section_id is not null;

drop policy if exists "students read published scoped course materials" on public.course_materials;
drop policy if exists "faculty manage scoped course materials" on public.course_materials;
drop policy if exists "authorized users read scoped course materials" on public.course_materials;
drop policy if exists "faculty insert scoped course materials" on public.course_materials;
drop policy if exists "faculty update scoped course materials" on public.course_materials;
drop policy if exists "faculty delete scoped course materials" on public.course_materials;

create policy "authorized users read scoped course materials"
  on public.course_materials for select to authenticated
  using (
    private.can_manage_course_material(course_id, class_section_id)
    or (
      published
      and private.student_can_read_course_material(course_id, class_section_id)
    )
  );

create policy "faculty insert scoped course materials"
  on public.course_materials for insert to authenticated
  with check (
    private.can_manage_course_material(course_id, class_section_id)
    and created_by = (select auth.uid())
  );

create policy "faculty update scoped course materials"
  on public.course_materials for update to authenticated
  using (private.can_manage_course_material(course_id, class_section_id))
  with check (
    private.can_manage_course_material(course_id, class_section_id)
    and created_by = (select auth.uid())
  );

create policy "faculty delete scoped course materials"
  on public.course_materials for delete to authenticated
  using (private.can_manage_course_material(course_id, class_section_id));
