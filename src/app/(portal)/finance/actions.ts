'use server';

import { revalidatePath } from 'next/cache';
import { requireActiveGovernanceRole } from '@/lib/governance-server';
import { requiredText } from '@/lib/validation';

function optional(value: FormDataEntryValue | null, max = 2000) { const text=String(value??'').trim(); if(!text)return null; if(text.length>max)throw new Error('A value is too long.'); return text; }
function refreshFinance(){for(const path of ['/finance','/student/finance','/admin','/admin/audit']) revalidatePath(path);}

export async function updateFinanceAccount(formData: FormData) {
  const { user, admin }=await requireActiveGovernanceRole(['finance','admin']);
  const studentId=requiredText(formData.get('student_id'),'Student',64);
  const amountDue=Number(requiredText(formData.get('amount_due'),'Amount due',30));
  const status=requiredText(formData.get('financial_status'),'Financial status',20);
  const notes=optional(formData.get('notes'));
  if(!Number.isFinite(amountDue)||amountDue<0) throw new Error('Amount due must be zero or greater.');
  if(!['unassessed','pending','partial','cleared','overdue','waived'].includes(status)) throw new Error('Financial status is invalid.');
  const { error }=await admin.rpc('finance_set_student_account',{target_student_id:studentId,assessed_amount:amountDue,new_status:status,finance_notes:notes,reviewer_id:user.id});
  if(error) throw new Error(error.message); refreshFinance();
}

export async function recordStudentPayment(formData: FormData) {
  const { user, admin }=await requireActiveGovernanceRole(['finance','admin']);
  const studentId=requiredText(formData.get('student_id'),'Student',64);
  const amount=Number(requiredText(formData.get('amount'),'Payment amount',30));
  const reference=optional(formData.get('reference'),160);
  const method=requiredText(formData.get('payment_method'),'Payment method',80);
  const paidAtText=optional(formData.get('paid_at'),40);
  if(!Number.isFinite(amount)||amount<=0) throw new Error('Payment amount must be greater than zero.');
  const paidAt=paidAtText ? new Date(paidAtText) : new Date();
  if(Number.isNaN(paidAt.getTime())) throw new Error('Payment date is invalid.');
  const { error }=await admin.rpc('finance_record_student_payment',{target_student_id:studentId,payment_amount:amount,payment_reference:reference,method,payment_date:paidAt.toISOString(),reviewer_id:user.id});
  if(error) throw new Error(error.message); refreshFinance();
}
