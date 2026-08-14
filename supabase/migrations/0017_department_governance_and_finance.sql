-- Department governance, registrar ownership, and student finance records.
create type public.registration_status as enum ('provisional', 'registered', 'deferred', 'withdrawn', 'graduated');
create type public.financial_status as enum ('unassessed', 'pending', 'partial', 'cleared', 'overdue', 'waived');

alter table public.profiles add column if not exists registration_status public.registration_status;
update public.profiles set registration_status = 'registered' where role = 'student' and registration_status is null;
alter table public.profiles drop constraint if exists profiles_student_registration_status_required;
alter table public.profiles add constraint profiles_student_registration_status_required
  check (role <> 'student' or registration_status is not null);

create or replace function private.normalize_profile_registration_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.role = 'student' and new.registration_status is null then
    new.registration_status := 'registered'::public.registration_status;
  elsif new.role <> 'student' then
    new.registration_status := null;
  end if;
  return new;
end $$;

drop trigger if exists profiles_normalize_registration_status on public.profiles;
create trigger profiles_normalize_registration_status
before insert or update of role, registration_status on public.profiles
for each row execute function private.normalize_profile_registration_status();

create table if not exists public.student_finance_accounts (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  amount_due numeric(12,2) not null default 0 check (amount_due >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  status public.financial_status not null default 'unassessed',
  notes text check (notes is null or char_length(notes) <= 2000),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.student_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  reference text,
  payment_method text not null default 'other' check (char_length(payment_method) between 2 and 80),
  paid_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index if not exists student_payments_reference_ci_unique
  on public.student_payments(lower(btrim(reference))) where reference is not null and btrim(reference) <> '';
create index if not exists student_finance_status_idx on public.student_finance_accounts(status, updated_at desc);
create index if not exists student_payments_student_paid_idx on public.student_payments(student_id, paid_at desc);

alter table public.student_finance_accounts enable row level security;
alter table public.student_payments enable row level security;
revoke all on public.student_finance_accounts from public, anon;
revoke all on public.student_payments from public, anon;
grant select on public.student_finance_accounts to authenticated;
grant select on public.student_payments to authenticated;
grant all on public.student_finance_accounts to service_role;
grant all on public.student_payments to service_role;

create policy "students read own finance account" on public.student_finance_accounts for select to authenticated
  using (student_id = (select auth.uid()));
create policy "finance and admins read finance accounts" on public.student_finance_accounts for select to authenticated
  using ((select private.auth_role()) in ('finance'::public.user_role, 'admin'::public.user_role));
create policy "students read own payments" on public.student_payments for select to authenticated
  using (student_id = (select auth.uid()));
create policy "finance and admins read payments" on public.student_payments for select to authenticated
  using ((select private.auth_role()) in ('finance'::public.user_role, 'admin'::public.user_role));

create or replace function public.hod_assign_lecturer_department(target_lecturer_id uuid, target_department_id uuid, reviewer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare reviewer public.profiles%rowtype; target public.profiles%rowtype;
begin
  select * into reviewer from public.profiles where id = reviewer_id and account_status = 'active';
  if not found or reviewer.role not in ('hod','admin') then raise exception 'HOD or administrator authorization required' using errcode='42501'; end if;
  if reviewer.role = 'hod' and reviewer.department_id is distinct from target_department_id then raise exception 'HODs may govern only their own department' using errcode='42501'; end if;
  if not exists(select 1 from public.departments where id=target_department_id) then raise exception 'Department not found' using errcode='P0002'; end if;
  select * into target from public.profiles where id=target_lecturer_id and role='lecturer' for update;
  if not found then raise exception 'Lecturer not found' using errcode='P0002'; end if;
  if reviewer.role='hod' and target.department_id is not null and target.department_id is distinct from target_department_id then raise exception 'This lecturer belongs to another department' using errcode='42501'; end if;
  update public.profiles set department_id=target_department_id where id=target_lecturer_id;
  insert into public.audit_log(actor_id,action,target_table,target_id,old_value,new_value)
  values(reviewer_id,'hod.lecturer.department.assign','profiles',target_lecturer_id,jsonb_build_object('department_id',target.department_id),jsonb_build_object('department_id',target_department_id));
end $$;

create or replace function public.hod_set_lecturer_status(target_lecturer_id uuid, new_status public.account_status, reviewer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare reviewer public.profiles%rowtype; target public.profiles%rowtype;
begin
  select * into reviewer from public.profiles where id=reviewer_id and account_status='active';
  if not found or reviewer.role not in ('hod','admin') then raise exception 'HOD or administrator authorization required' using errcode='42501'; end if;
  select * into target from public.profiles where id=target_lecturer_id and role='lecturer' for update;
  if not found then raise exception 'Lecturer not found' using errcode='P0002'; end if;
  if reviewer.role='hod' and target.department_id is distinct from reviewer.department_id then raise exception 'HODs may govern only lecturers in their own department' using errcode='42501'; end if;
  update public.profiles set account_status=new_status where id=target_lecturer_id;
  insert into public.audit_log(actor_id,action,target_table,target_id,old_value,new_value)
  values(reviewer_id,'hod.lecturer.status.update','profiles',target_lecturer_id,jsonb_build_object('account_status',target.account_status),jsonb_build_object('account_status',new_status));
end $$;

create or replace function public.hod_assign_student_cohort(target_student_id uuid, target_cohort_id uuid, reviewer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare reviewer public.profiles%rowtype; student public.profiles%rowtype; target_department uuid; previous_cohort uuid;
begin
  select * into reviewer from public.profiles where id=reviewer_id and account_status='active';
  if not found or reviewer.role not in ('hod','admin') then raise exception 'HOD or administrator authorization required' using errcode='42501'; end if;
  select * into student from public.profiles where id=target_student_id and role='student' for update;
  if not found then raise exception 'Student not found' using errcode='P0002'; end if;
  if student.registration_status <> 'registered' then raise exception 'Only registered students can be assigned to classes' using errcode='22023'; end if;
  select department_id into target_department from public.cohorts where id=target_cohort_id;
  if target_department is null then raise exception 'Class/cohort not found' using errcode='P0002'; end if;
  if student.department_id is distinct from target_department then raise exception 'Class/cohort must belong to the student department' using errcode='22023'; end if;
  if reviewer.role='hod' and reviewer.department_id is distinct from target_department then raise exception 'HODs may assign classes only in their own department' using errcode='42501'; end if;
  previous_cohort := student.cohort_id;
  update public.profiles set cohort_id=target_cohort_id where id=target_student_id;
  update public.enrollments e set status='dropped'
    where e.student_id=target_student_id and e.managed_by_cohort and e.status='active'
      and (e.source_cohort_id is distinct from target_cohort_id or not exists(select 1 from public.courses c where c.id=e.course_id and c.cohort_id=target_cohort_id));
  insert into public.enrollments(student_id,course_id,status,managed_by_cohort,source_cohort_id)
    select target_student_id,c.id,'active'::public.enrollment_status,true,target_cohort_id from public.courses c where c.cohort_id=target_cohort_id
    on conflict(student_id,course_id) do update set status=case when public.enrollments.status='completed' then 'completed'::public.enrollment_status else 'active'::public.enrollment_status end, managed_by_cohort=true, source_cohort_id=target_cohort_id;
  insert into public.audit_log(actor_id,action,target_table,target_id,old_value,new_value)
  values(reviewer_id,'hod.student.class.assign','profiles',target_student_id,jsonb_build_object('cohort_id',previous_cohort),jsonb_build_object('cohort_id',target_cohort_id));
end $$;

create or replace function public.hod_assign_course_lecturer(target_course_id uuid, target_lecturer_id uuid, reviewer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare reviewer public.profiles%rowtype; lecturer public.profiles%rowtype; course_department uuid; previous_lecturer uuid;
begin
  select * into reviewer from public.profiles where id=reviewer_id and account_status='active';
  if not found or reviewer.role not in ('hod','admin') then raise exception 'HOD or administrator authorization required' using errcode='42501'; end if;
  select department_id, lecturer_id into course_department, previous_lecturer from public.courses where id=target_course_id for update;
  if course_department is null then raise exception 'Course not found' using errcode='P0002'; end if;
  select * into lecturer from public.profiles where id=target_lecturer_id and role='lecturer' and account_status='active';
  if not found then raise exception 'Active lecturer not found' using errcode='P0002'; end if;
  if lecturer.department_id is distinct from course_department then raise exception 'Lecturer and course must belong to the same department' using errcode='22023'; end if;
  if reviewer.role='hod' and reviewer.department_id is distinct from course_department then raise exception 'HODs may assign teaching only in their own department' using errcode='42501'; end if;
  update public.courses set lecturer_id=target_lecturer_id where id=target_course_id;
  insert into public.audit_log(actor_id,action,target_table,target_id,old_value,new_value)
  values(reviewer_id,'hod.course.lecturer.assign','courses',target_course_id,jsonb_build_object('lecturer_id',previous_lecturer),jsonb_build_object('lecturer_id',target_lecturer_id));
end $$;

create or replace function public.record_application_approval(target_application_id uuid, reviewer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare previous_status public.application_status;
begin
  if not exists(select 1 from public.profiles where id=reviewer_id and role in ('registrar','admin') and account_status='active') then raise exception 'Registrar or administrator authorization required' using errcode='42501'; end if;
  select status into previous_status from public.applications where id=target_application_id for update;
  if not found or previous_status not in ('pending','under_review') then raise exception 'Pending application not found' using errcode='P0002'; end if;
  update public.applications set status='approved',reviewed_by=reviewer_id,reviewed_at=now() where id=target_application_id;
  insert into public.audit_log(actor_id,action,target_table,target_id,old_value,new_value) values(reviewer_id,'application.approve','applications',target_application_id,jsonb_build_object('status',previous_status),jsonb_build_object('status','approved'));
end $$;

create or replace function public.reject_application(target_application_id uuid, reviewer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare previous_status public.application_status;
begin
  if not exists(select 1 from public.profiles where id=reviewer_id and role in ('registrar','admin') and account_status='active') then raise exception 'Registrar or administrator authorization required' using errcode='42501'; end if;
  select status into previous_status from public.applications where id=target_application_id for update;
  if not found or previous_status not in ('pending','under_review') then raise exception 'Pending application not found' using errcode='P0002'; end if;
  update public.applications set status='rejected',reviewed_by=reviewer_id,reviewed_at=now() where id=target_application_id;
  insert into public.audit_log(actor_id,action,target_table,target_id,old_value,new_value) values(reviewer_id,'application.reject','applications',target_application_id,jsonb_build_object('status',previous_status),jsonb_build_object('status','rejected'));
end $$;

create or replace function public.registrar_enroll_application_student(target_application_id uuid, target_student_id uuid, student_registration_number text, target_department_id uuid, student_year_of_study smallint, reviewer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare application_record public.applications%rowtype; existing_role public.user_role; final_department_id uuid;
begin
  if not exists(select 1 from public.profiles where id=reviewer_id and role in ('registrar','admin') and account_status='active') then raise exception 'Registrar or administrator authorization required' using errcode='42501'; end if;
  select * into application_record from public.applications where id=target_application_id for update;
  if not found or application_record.status <> 'approved' then raise exception 'Approved application not found' using errcode='P0002'; end if;
  if application_record.enrolled_student_id is not null then raise exception 'This applicant is already enrolled' using errcode='23505'; end if;
  final_department_id := coalesce(target_department_id,application_record.department_id);
  if final_department_id is null or not exists(select 1 from public.departments where id=final_department_id) then raise exception 'Valid department of study is required' using errcode='22023'; end if;
  if student_year_of_study is not null and student_year_of_study not between 1 and 8 then raise exception 'Year of study is invalid' using errcode='22023'; end if;
  select role into existing_role from public.profiles where id=target_student_id for update;
  if found and existing_role <> 'student' then raise exception 'This account is not a student account' using errcode='42501'; end if;
  if exists(select 1 from public.profiles where id<>target_student_id and upper(registration_number)=upper(btrim(student_registration_number))) then raise exception 'Registration number is already assigned' using errcode='23505'; end if;
  if exists(select 1 from public.profiles where id<>target_student_id and lower(email)=lower(btrim(application_record.email))) then raise exception 'Email address is already assigned' using errcode='23505'; end if;
  insert into public.profiles(id,role,full_name,email,registration_number,department_id,cohort_id,year_of_study,account_status,registration_status)
  values(target_student_id,'student',application_record.full_name,lower(btrim(application_record.email)),upper(btrim(student_registration_number)),final_department_id,null,student_year_of_study,'active','registered')
  on conflict(id) do update set role='student',full_name=excluded.full_name,email=excluded.email,registration_number=excluded.registration_number,department_id=excluded.department_id,year_of_study=excluded.year_of_study,account_status='active',registration_status='registered';
  update public.applications set enrolled_student_id=target_student_id,enrolled_at=now() where id=target_application_id;
  insert into public.audit_log(actor_id,action,target_table,target_id,new_value) values(reviewer_id,'registrar.student.register','applications',target_application_id,jsonb_build_object('student_id',target_student_id,'registration_number',upper(btrim(student_registration_number)),'department_id',final_department_id,'year_of_study',student_year_of_study));
end $$;

create or replace function public.registrar_update_student_registration(target_student_id uuid, student_full_name text, student_email text, student_registration_number text, target_department_id uuid, student_year_of_study smallint, new_registration_status public.registration_status, reviewer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare reviewer public.profiles%rowtype; previous public.profiles%rowtype; clear_class boolean := false;
begin
  select * into reviewer from public.profiles where id=reviewer_id and role in ('registrar','admin') and account_status='active';
  if not found then raise exception 'Registrar or administrator authorization required' using errcode='42501'; end if;
  select * into previous from public.profiles where id=target_student_id and role='student' for update;
  if not found then raise exception 'Student record not found' using errcode='P0002'; end if;
  if target_department_id is null or not exists(select 1 from public.departments where id=target_department_id) then raise exception 'Valid department is required' using errcode='22023'; end if;
  if student_year_of_study is not null and student_year_of_study not between 1 and 8 then raise exception 'Year of study is invalid' using errcode='22023'; end if;
  if exists(select 1 from public.profiles where id<>target_student_id and upper(registration_number)=upper(btrim(student_registration_number))) then raise exception 'Registration number is already assigned' using errcode='23505'; end if;
  if exists(select 1 from public.profiles where id<>target_student_id and lower(email)=lower(btrim(student_email))) then raise exception 'Email address is already assigned' using errcode='23505'; end if;
  clear_class := previous.department_id is distinct from target_department_id or new_registration_status <> 'registered';
  update public.profiles set full_name=left(btrim(student_full_name),160),email=lower(btrim(student_email)),registration_number=upper(btrim(student_registration_number)),department_id=target_department_id,year_of_study=student_year_of_study,registration_status=new_registration_status,cohort_id=case when clear_class then null else cohort_id end where id=target_student_id;
  if clear_class then update public.enrollments set status='dropped' where student_id=target_student_id and managed_by_cohort and status='active'; end if;
  insert into public.audit_log(actor_id,action,target_table,target_id,old_value,new_value) values(reviewer_id,'registrar.student.registration.update','profiles',target_student_id,jsonb_build_object('registration_number',previous.registration_number,'department_id',previous.department_id,'year_of_study',previous.year_of_study,'registration_status',previous.registration_status),jsonb_build_object('registration_number',upper(btrim(student_registration_number)),'department_id',target_department_id,'year_of_study',student_year_of_study,'registration_status',new_registration_status));
end $$;

create or replace function public.admin_create_staff_member(target_staff_id uuid, staff_full_name text, staff_email text, staff_role public.user_role, target_department_id uuid, reviewer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.profiles where id=reviewer_id and role='admin' and account_status='active') then raise exception 'Administrator authorization required' using errcode='42501'; end if;
  if staff_role not in ('lecturer','hod','registrar','finance') then raise exception 'Invalid staff governance role' using errcode='22023'; end if;
  if staff_role in ('lecturer','hod') and (target_department_id is null or not exists(select 1 from public.departments where id=target_department_id)) then raise exception 'Lecturer and HOD accounts require a valid department' using errcode='22023'; end if;
  if exists(select 1 from public.profiles where id=target_staff_id or lower(email)=lower(btrim(staff_email))) then raise exception 'A MIPC profile already exists for this staff identity' using errcode='23505'; end if;
  insert into public.profiles(id,role,full_name,email,department_id,cohort_id,account_status,registration_number,year_of_study,registration_status)
  values(target_staff_id,staff_role,left(btrim(staff_full_name),160),lower(btrim(staff_email)),case when staff_role in ('lecturer','hod') then target_department_id else null end,null,'active',null,null,null);
  insert into public.audit_log(actor_id,action,target_table,target_id,new_value) values(reviewer_id,'staff.account.create','profiles',target_staff_id,jsonb_build_object('role',staff_role,'email',lower(btrim(staff_email)),'department_id',case when staff_role in ('lecturer','hod') then target_department_id else null end));
end $$;

create or replace function public.finance_set_student_account(target_student_id uuid, assessed_amount numeric, new_status public.financial_status, finance_notes text, reviewer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare existing_paid numeric := 0;
begin
  if not exists(select 1 from public.profiles where id=reviewer_id and role in ('finance','admin') and account_status='active') then raise exception 'Finance or administrator authorization required' using errcode='42501'; end if;
  if assessed_amount < 0 then raise exception 'Assessed amount cannot be negative' using errcode='22023'; end if;
  if not exists(select 1 from public.profiles where id=target_student_id and role='student') then raise exception 'Student not found' using errcode='P0002'; end if;
  select amount_paid into existing_paid from public.student_finance_accounts where student_id=target_student_id;
  existing_paid := coalesce(existing_paid,0);
  insert into public.student_finance_accounts(student_id,amount_due,amount_paid,status,notes,updated_by,updated_at)
  values(target_student_id,assessed_amount,existing_paid,new_status,nullif(left(btrim(coalesce(finance_notes,'')),2000),''),reviewer_id,now())
  on conflict(student_id) do update set amount_due=excluded.amount_due,status=excluded.status,notes=excluded.notes,updated_by=reviewer_id,updated_at=now();
  insert into public.audit_log(actor_id,action,target_table,target_id,new_value) values(reviewer_id,'finance.account.update','student_finance_accounts',target_student_id,jsonb_build_object('amount_due',assessed_amount,'amount_paid',existing_paid,'status',new_status));
end $$;

create or replace function public.finance_record_student_payment(target_student_id uuid, payment_amount numeric, payment_reference text, method text, payment_date timestamptz, reviewer_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare payment_id uuid; due numeric := 0; paid numeric := 0; next_status public.financial_status;
begin
  if not exists(select 1 from public.profiles where id=reviewer_id and role in ('finance','admin') and account_status='active') then raise exception 'Finance or administrator authorization required' using errcode='42501'; end if;
  if payment_amount <= 0 then raise exception 'Payment amount must be positive' using errcode='22023'; end if;
  if not exists(select 1 from public.profiles where id=target_student_id and role='student') then raise exception 'Student not found' using errcode='P0002'; end if;
  insert into public.student_finance_accounts(student_id,amount_due,amount_paid,status,updated_by) values(target_student_id,0,0,'unassessed',reviewer_id) on conflict(student_id) do nothing;
  select amount_due,amount_paid into due,paid from public.student_finance_accounts where student_id=target_student_id for update;
  insert into public.student_payments(student_id,amount,reference,payment_method,paid_at,recorded_by) values(target_student_id,payment_amount,nullif(left(btrim(coalesce(payment_reference,'')),160),''),left(btrim(method),80),coalesce(payment_date,now()),reviewer_id) returning id into payment_id;
  paid := paid + payment_amount;
  next_status := case when due > 0 and paid >= due then 'cleared'::public.financial_status when paid > 0 then 'partial'::public.financial_status else 'unassessed'::public.financial_status end;
  update public.student_finance_accounts set amount_paid=paid,status=case when status='waived' then status else next_status end,updated_by=reviewer_id,updated_at=now() where student_id=target_student_id;
  insert into public.audit_log(actor_id,action,target_table,target_id,new_value) values(reviewer_id,'finance.payment.record','student_payments',payment_id,jsonb_build_object('student_id',target_student_id,'amount',payment_amount,'reference',nullif(btrim(coalesce(payment_reference,'')),''),'status_after',next_status));
  return payment_id;
end $$;

revoke all on function public.hod_assign_lecturer_department(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.hod_set_lecturer_status(uuid,public.account_status,uuid) from public,anon,authenticated;
revoke all on function public.hod_assign_student_cohort(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.hod_assign_course_lecturer(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.record_application_approval(uuid,uuid) from public,anon,authenticated;
revoke all on function public.reject_application(uuid,uuid) from public,anon,authenticated;
revoke all on function public.registrar_enroll_application_student(uuid,uuid,text,uuid,smallint,uuid) from public,anon,authenticated;
revoke all on function public.registrar_update_student_registration(uuid,text,text,text,uuid,smallint,public.registration_status,uuid) from public,anon,authenticated;
revoke all on function public.admin_create_staff_member(uuid,text,text,public.user_role,uuid,uuid) from public,anon,authenticated;
revoke all on function public.finance_set_student_account(uuid,numeric,public.financial_status,text,uuid) from public,anon,authenticated;
revoke all on function public.finance_record_student_payment(uuid,numeric,text,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.hod_assign_lecturer_department(uuid,uuid,uuid) to service_role;
grant execute on function public.hod_set_lecturer_status(uuid,public.account_status,uuid) to service_role;
grant execute on function public.hod_assign_student_cohort(uuid,uuid,uuid) to service_role;
grant execute on function public.hod_assign_course_lecturer(uuid,uuid,uuid) to service_role;
grant execute on function public.record_application_approval(uuid,uuid) to service_role;
grant execute on function public.reject_application(uuid,uuid) to service_role;
grant execute on function public.registrar_enroll_application_student(uuid,uuid,text,uuid,smallint,uuid) to service_role;
grant execute on function public.registrar_update_student_registration(uuid,text,text,text,uuid,smallint,public.registration_status,uuid) to service_role;
grant execute on function public.admin_create_staff_member(uuid,text,text,public.user_role,uuid,uuid) to service_role;
grant execute on function public.finance_set_student_account(uuid,numeric,public.financial_status,text,uuid) to service_role;
grant execute on function public.finance_record_student_payment(uuid,numeric,text,text,timestamptz,uuid) to service_role;
