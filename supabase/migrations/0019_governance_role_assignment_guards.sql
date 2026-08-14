-- Keep direct Principal role changes consistent with the governance model.
create or replace function public.admin_update_user(target_user_id uuid, new_role public.user_role, new_status public.account_status, reviewer_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare previous public.profiles%rowtype;
begin
  if not exists(select 1 from public.profiles where id=reviewer_id and role='admin' and account_status='active') then raise exception 'Administrator authorization required' using errcode='42501'; end if;
  select * into previous from public.profiles where id=target_user_id for update;
  if not found then raise exception 'User not found' using errcode='P0002'; end if;
  if target_user_id=reviewer_id and (new_role<>'admin' or new_status<>'active') then raise exception 'Administrators cannot remove or suspend their own access' using errcode='22023'; end if;
  if previous.role='admin' and previous.account_status='active' and (new_role<>'admin' or new_status<>'active') and (select count(*) from public.profiles where role='admin' and account_status='active')<=1 then raise exception 'At least one active administrator is required' using errcode='22023'; end if;
  if new_role in ('lecturer','hod') and previous.department_id is null then raise exception 'Lecturer and HOD roles require a department assignment' using errcode='22023'; end if;
  if new_role='student' and nullif(btrim(coalesce(previous.registration_number,'')),'') is null then raise exception 'Student access requires a registration number' using errcode='22023'; end if;
  update public.profiles set role=new_role,account_status=new_status where id=target_user_id;
  insert into public.audit_log(actor_id,action,target_table,target_id,old_value,new_value) values(reviewer_id,'user.access.update','profiles',target_user_id,jsonb_build_object('role',previous.role,'account_status',previous.account_status),jsonb_build_object('role',new_role,'account_status',new_status));
end $$;

revoke all on function public.admin_update_user(uuid,public.user_role,public.account_status,uuid) from public,anon,authenticated;
grant execute on function public.admin_update_user(uuid,public.user_role,public.account_status,uuid) to service_role;
