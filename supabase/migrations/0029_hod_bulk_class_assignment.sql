-- Support scalable HOD class placement without partial multi-student updates.
create or replace function public.hod_bulk_assign_students_class_section(
  target_student_ids uuid[],
  target_class_section_id uuid,
  reviewer_id uuid
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  reviewer public.profiles%rowtype;
  unique_student_ids uuid[];
  student_id uuid;
  assigned_count integer := 0;
begin
  select * into reviewer
  from public.profiles
  where id = reviewer_id and account_status = 'active';

  if not found or reviewer.role not in ('hod','admin') then
    raise exception 'HOD or administrator authorization required' using errcode='42501';
  end if;

  if target_student_ids is null or cardinality(target_student_ids) = 0 then
    raise exception 'Select at least one student' using errcode='22023';
  end if;

  if cardinality(target_student_ids) > 100 then
    raise exception 'A maximum of 100 students can be assigned at once' using errcode='22023';
  end if;

  select array_agg(distinct candidate_id)
  into unique_student_ids
  from unnest(target_student_ids) as candidate_id
  where candidate_id is not null;

  if unique_student_ids is null or cardinality(unique_student_ids) = 0 then
    raise exception 'Select at least one valid student' using errcode='22023';
  end if;

  -- Each single-student assignment retains the existing department, year,
  -- cohort, capacity, enrollment synchronization and audit checks. Because
  -- this loop runs inside one database function call, any raised exception
  -- aborts the whole transaction rather than leaving a partial bulk move.
  foreach student_id in array unique_student_ids loop
    perform public.hod_assign_student_class_section(
      student_id,
      target_class_section_id,
      reviewer_id
    );
    assigned_count := assigned_count + 1;
  end loop;

  return assigned_count;
end $$;

revoke all on function public.hod_bulk_assign_students_class_section(uuid[],uuid,uuid) from public, anon, authenticated;
grant execute on function public.hod_bulk_assign_students_class_section(uuid[],uuid,uuid) to service_role;
