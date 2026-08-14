'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import type { AccountStatus } from '@/lib/database.types';
import type { AccountRole } from '@/lib/roles';
import { createAdminClient, createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { findAuthUserByEmail } from '@/lib/supabase/admin-users';
import { requiredText, uuid, ValidationError } from '@/lib/validation';

async function requireAdmin() {
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('role,account_status').eq('id',user.id).single();
  if((profile as any)?.role!=='admin'||(profile as any)?.account_status!=='active') throw new Error('Principal / administrator authorization required.');
  return user;
}
function optional(value:FormDataEntryValue|null,max=160){const text=String(value??'').trim();if(!text)return null;if(text.length>max)throw new ValidationError('A value is too long.');return text;}
function refreshUsers(){for(const path of ['/admin/users','/admin','/hod','/registrar','/finance','/admin/audit'])revalidatePath(path);}

export async function createStaffMember(formData:FormData){
  if(!isSupabaseConfigured()) throw new Error('Live staff provisioning requires the connected database.');
  const actor=await requireAdmin(); const admin=createAdminClient() as any;
  const fullName=requiredText(formData.get('full_name'),'Full name',160);
  const email=requiredText(formData.get('email'),'Email',320).toLowerCase();
  const role=requiredText(formData.get('role'),'Staff role',20) as AccountRole;
  const departmentId=optional(formData.get('department_id'),64);
  if(!['lecturer','hod','registrar','finance'].includes(role)) throw new ValidationError('Choose a valid staff governance role.');
  if(['lecturer','hod'].includes(role)&&!departmentId) throw new ValidationError('Lecturer and HOD accounts require a department.');
  const {data:existingProfile,error:profileError}=await admin.from('profiles').select('id').ilike('email',email).maybeSingle();
  if(profileError)throw new Error('Existing MIPC profile could not be checked.'); if(existingProfile)throw new ValidationError('A MIPC profile already exists for this email.');
  let staffId:string; let createdAuthUser=false; const existingAuth=await findAuthUserByEmail(admin,email);
  if(existingAuth){const {data:linked}=await admin.from('profiles').select('id').eq('id',existingAuth.id).maybeSingle();if(linked)throw new ValidationError('This sign-in identity is already linked to another MIPC profile.');staffId=existingAuth.id;}
  else {const {data,error}=await admin.auth.admin.createUser({email,email_confirm:true,user_metadata:{full_name:fullName}});if(error||!data.user)throw new Error(error?.message||'Staff sign-in identity could not be created.');staffId=data.user.id;createdAuthUser=true;}
  const {error}=await admin.rpc('admin_create_staff_member',{target_staff_id:staffId,staff_full_name:fullName,staff_email:email,staff_role:role,target_department_id:departmentId,reviewer_id:actor.id});
  if(error){if(createdAuthUser){const cleanup=await admin.auth.admin.deleteUser(staffId);if(cleanup.error)console.error('Staff Auth compensation failed',{staffId,message:cleanup.error.message});}throw new Error(error.message);}
  refreshUsers();
}

export async function updateUserAccess(formData: FormData) {
  const connected=isSupabaseConfigured(); const rawUserId=requiredText(formData.get('user_id'),'User',64); const userId=connected?uuid(rawUserId,'User'):rawUserId;
  const role=requiredText(formData.get('role'),'Role',20) as AccountRole; const status=requiredText(formData.get('account_status'),'Account status',20) as AccountStatus;
  if(!['student','lecturer','hod','registrar','finance','admin'].includes(role))throw new ValidationError('Role is invalid.');
  if(!['active','suspended'].includes(status))throw new ValidationError('Account status is invalid.');
  if(connected){
    const actor=await requireAdmin(); const admin=createAdminClient() as any;
    const {data:target,error:targetError}=await admin.from('profiles').select('department_id,registration_number').eq('id',userId).single();
    if(targetError||!target)throw new ValidationError('User not found.');
    if(['lecturer','hod'].includes(role)&&!target.department_id)throw new ValidationError('Lecturer and HOD roles require a department assignment.');
    if(role==='student'&&!target.registration_number)throw new ValidationError('Student access requires an assigned registration number.');
    const {error}=await admin.rpc('admin_update_user',{target_user_id:userId,new_role:role,new_status:status,reviewer_id:actor.id}); if(error)throw new Error(error.message);
  } else {
    const target=dataStore.profiles.find((item)=>item.id===userId); if(!target)throw new ValidationError('User not found.');
    if(target.id==='user-admin-1'&&(role!=='admin'||status!=='active'))throw new ValidationError('The demonstration administrator cannot remove their own access.');
    if(!['student','lecturer','admin'].includes(role))throw new ValidationError('Governance roles require the live database.');
    target.role=role as any; target.account_status=status; dataStore.audit_log.unshift({id:Date.now(),actor_id:'user-admin-1',action:'user.access.update',target_table:'profiles',target_id:userId,old_value:null,new_value:{role,account_status:status},created_at:new Date().toISOString()});
  }
  refreshUsers();
}
