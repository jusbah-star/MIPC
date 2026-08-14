'use server';

import { revalidatePath } from 'next/cache';
import { findAuthUserByEmail } from '@/lib/supabase/admin-users';
import { requireActiveGovernanceRole } from '@/lib/governance-server';
import { deliverApplicationNotifications } from '@/lib/application-mail';
import { requiredText } from '@/lib/validation';

function optional(value: FormDataEntryValue | null, max = 160) { const text=String(value??'').trim(); if(!text)return null; if(text.length>max)throw new Error('A value is too long.'); return text; }
function refreshRegistrar() { for (const path of ['/registrar','/registrar/applications','/registrar/students','/admin','/admin/applications','/admin/students','/admin/audit']) revalidatePath(path); }

export async function approveApplication(formData: FormData) {
  const { user, admin } = await requireActiveGovernanceRole(['registrar','admin']);
  const applicationId = requiredText(formData.get('application_id'),'Application',64);
  const { error } = await admin.rpc('record_application_approval',{target_application_id:applicationId,reviewer_id:user.id});
  if(error) throw new Error(error.message);
  await deliverApplicationNotifications(admin, applicationId);
  refreshRegistrar();
}

export async function rejectApplication(formData: FormData) {
  const { user, admin } = await requireActiveGovernanceRole(['registrar','admin']);
  const applicationId = requiredText(formData.get('application_id'),'Application',64);
  const { error } = await admin.rpc('reject_application',{target_application_id:applicationId,reviewer_id:user.id});
  if(error) throw new Error(error.message);
  await deliverApplicationNotifications(admin, applicationId);
  refreshRegistrar();
}

export async function retryApplicationEmails(formData: FormData) {
  const { admin } = await requireActiveGovernanceRole(['registrar','admin']);
  const applicationId = requiredText(formData.get('application_id'),'Application',64);
  await deliverApplicationNotifications(admin, applicationId);
  refreshRegistrar();
}

export async function registerApprovedApplicant(formData: FormData) {
  const { user, admin } = await requireActiveGovernanceRole(['registrar','admin']);
  const applicationId = requiredText(formData.get('application_id'),'Application',64);
  const registrationNumber = requiredText(formData.get('registration_number'),'Registration number',40).toUpperCase();
  const departmentId = requiredText(formData.get('department_id'),'Department',64);
  const yearRaw = optional(formData.get('year_of_study'),2); const yearOfStudy=yearRaw?Number(yearRaw):null;
  if(yearOfStudy!==null&&(!Number.isInteger(yearOfStudy)||yearOfStudy<1||yearOfStudy>8)) throw new Error('Year of study is invalid.');
  const { data: application, error: applicationError } = await admin.from('applications').select('id,full_name,email,status,enrolled_student_id').eq('id',applicationId).eq('status','approved').single();
  if(applicationError||!application) throw new Error('Approved application not found.');
  if(application.enrolled_student_id) throw new Error('This applicant is already registered.');
  const email=String(application.email).trim().toLowerCase(); let studentId:string; let createdAuthUser=false;
  const { data: existingProfile, error: existingProfileError } = await admin.from('profiles').select('id,role').ilike('email',email).maybeSingle();
  if(existingProfileError) throw new Error('Existing MIPC account could not be checked.');
  if(existingProfile) { if(existingProfile.role!=='student') throw new Error('This email belongs to a non-student MIPC account.'); studentId=existingProfile.id; }
  else {
    const existingAuth=await findAuthUserByEmail(admin,email);
    if(existingAuth) { const { data: linked }=await admin.from('profiles').select('id').eq('id',existingAuth.id).maybeSingle(); if(linked) throw new Error('This sign-in identity is already linked to another profile.'); studentId=existingAuth.id; }
    else { const { data: authData, error: authError }=await admin.auth.admin.createUser({email,email_confirm:true,user_metadata:{full_name:application.full_name}}); if(authError||!authData.user) throw new Error(authError?.message||'Student sign-in identity could not be created.'); studentId=authData.user.id; createdAuthUser=true; }
  }
  const { error } = await admin.rpc('registrar_enroll_application_student',{target_application_id:applicationId,target_student_id:studentId,student_registration_number:registrationNumber,target_department_id:departmentId,student_year_of_study:yearOfStudy,reviewer_id:user.id});
  if(error){ if(createdAuthUser){const cleanup=await admin.auth.admin.deleteUser(studentId); if(cleanup.error) console.error('Registrar Auth compensation failed',{studentId,message:cleanup.error.message});} throw new Error(error.message); }
  refreshRegistrar();
}

export async function updateStudentRegistration(formData: FormData) {
  const { user, admin } = await requireActiveGovernanceRole(['registrar','admin']);
  const studentId=requiredText(formData.get('student_id'),'Student',64);
  const fullName=requiredText(formData.get('full_name'),'Full name',160);
  const email=requiredText(formData.get('email'),'Email',320).toLowerCase();
  const registrationNumber=requiredText(formData.get('registration_number'),'Registration number',40).toUpperCase();
  const departmentId=requiredText(formData.get('department_id'),'Department',64);
  const yearRaw=optional(formData.get('year_of_study'),2); const yearOfStudy=yearRaw?Number(yearRaw):null;
  const registrationStatus=requiredText(formData.get('registration_status'),'Registration status',20);
  if(!['provisional','registered','deferred','withdrawn','graduated'].includes(registrationStatus)) throw new Error('Registration status is invalid.');
  const { data: current, error: currentError }=await admin.from('profiles').select('email,role').eq('id',studentId).eq('role','student').single();
  if(currentError||!current) throw new Error('Student record could not be found.');
  const previousEmail=String(current.email).trim().toLowerCase(); const emailChanged=previousEmail!==email;
  if(emailChanged){const authUpdate=await admin.auth.admin.updateUserById(studentId,{email,email_confirm:true}); if(authUpdate.error) throw new Error(authUpdate.error.message);}
  const { error }=await admin.rpc('registrar_update_student_registration',{target_student_id:studentId,student_full_name:fullName,student_email:email,student_registration_number:registrationNumber,target_department_id:departmentId,student_year_of_study:yearOfStudy,new_registration_status:registrationStatus,reviewer_id:user.id});
  if(error){if(emailChanged){const revert=await admin.auth.admin.updateUserById(studentId,{email:previousEmail,email_confirm:true}); if(revert.error) console.error('Registrar Auth email compensation failed',{studentId,message:revert.error.message});} throw new Error(error.message);}
  refreshRegistrar();
}
