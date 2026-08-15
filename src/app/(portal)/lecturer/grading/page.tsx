import Link from 'next/link';
import { CheckCircleIcon, FileTextIcon } from '@/components/icons';
import { dataStore } from '@/lib/data-store';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { getPortalSession } from '@/lib/portal-session';
import { recordGrade } from './actions';

const PAGE_SIZE = 30;
type SearchParams = { page?: string | string[]; status?: string | string[] };
function scalar(value:string|string[]|undefined){return Array.isArray(value)?value[0]??'':value??'';}

export default async function LecturerGradingPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const requestedPage = Math.max(1,Number.parseInt(scalar(params.page)||'1',10)||1);
  const statusFilter = scalar(params.status)==='graded' ? 'graded' : scalar(params.status)==='all' ? 'all' : 'pending';
  let submissions:any[] = dataStore.submissions;
  let assignments:any[] = dataStore.assignments;
  let profiles:any[] = dataStore.profiles;
  let total = submissions.length;
  let page = 1;
  let totalPages = 1;

  if (isSupabaseConfigured()) {
    const session = await getPortalSession();
    if (!session || !['lecturer','hod','admin'].includes(session.profile.role) || session.profile.account_status!=='active') throw new Error('Lecturer authentication required.');
    const { supabase } = session;

    function baseQuery() {
      let query:any = supabase.from('submissions').select('id,assignment_id,student_id,course_id,submitted_at,grade,feedback,content,file_path', { count:'exact' });
      if (statusFilter==='pending') query=query.is('grade',null);
      if (statusFilter==='graded') query=query.not('grade','is',null);
      return query;
    }

    const countResult = await baseQuery().select('id',{count:'exact',head:true});
    if(countResult.error) throw new Error(countResult.error.message);
    total=countResult.count??0;
    totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));
    page=Math.min(requestedPage,totalPages);
    const from=(page-1)*PAGE_SIZE;
    const submissionResult=await baseQuery().order('submitted_at',{ascending:false}).range(from,from+PAGE_SIZE-1);
    if(submissionResult.error) throw new Error(submissionResult.error.message);
    submissions=submissionResult.data??[];

    const assignmentIds=Array.from(new Set(submissions.map((item:any)=>item.assignment_id).filter(Boolean))) as string[];
    const studentIds=Array.from(new Set(submissions.map((item:any)=>item.student_id).filter(Boolean))) as string[];
    const [assignmentResult,studentResult]=await Promise.all([
      assignmentIds.length ? supabase.from('assignments').select('id,title,max_points').in('id',assignmentIds) : Promise.resolve({data:[],error:null}),
      studentIds.length ? supabase.from('profiles').select('id,full_name,registration_number').in('id',studentIds) : Promise.resolve({data:[],error:null})
    ] as any);
    if(assignmentResult.error||studentResult.error) throw new Error(assignmentResult.error?.message??studentResult.error?.message);
    assignments=assignmentResult.data??[];
    profiles=studentResult.data??[];
  } else {
    if(statusFilter==='pending') submissions=submissions.filter((item)=>item.grade===null);
    if(statusFilter==='graded') submissions=submissions.filter((item)=>item.grade!==null);
    total=submissions.length;
  }

  function pageHref(nextPage:number,status=statusFilter){const sp=new URLSearchParams();if(status!=='pending')sp.set('status',status);if(nextPage>1)sp.set('page',String(nextPage));const q=sp.toString();return `/lecturer/grading${q?`?${q}`:''}`;}

  return <div className="space-y-8">
    <header><p className="mipc-eyebrow">Assessment records</p><h1 className="mipc-page-title">Coursework grading</h1><p className="mt-2 max-w-2xl text-sm text-ink-700">The grading queue is paginated to 30 submissions so large classes do not load every response at once.</p></header>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><Link href={pageHref(1,'pending')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusFilter==='pending'?'bg-mipc-navy-950 text-white':'bg-parchment-100 text-ink-700'}`}>Awaiting review</Link><Link href={pageHref(1,'graded')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusFilter==='graded'?'bg-mipc-navy-950 text-white':'bg-parchment-100 text-ink-700'}`}>Graded</Link><Link href={pageHref(1,'all')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusFilter==='all'?'bg-mipc-navy-950 text-white':'bg-parchment-100 text-ink-700'}`}>All</Link></div><span className="mipc-status">{total} submission{total===1?'':'s'}</span></div>

    <div className="grid gap-5 xl:grid-cols-2">
      {submissions.map((submission)=>{const assignment=assignments.find((item)=>item.id===submission.assignment_id);const student=profiles.find((item)=>item.id===submission.student_id);if(!assignment)return null;return <article key={submission.id} className="mipc-panel overflow-hidden"><div className="border-b border-parchment-200 bg-parchment-50 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-mipc-green-700">{assignment.title}</p><h2 className="mt-1 font-display text-xl font-bold text-ink-950">{student?.full_name??'Student'}</h2>{student?.registration_number&&<p className="text-xs font-semibold text-mipc-green-700">{student.registration_number}</p>}<p className="text-xs text-ink-600">Submitted {new Date(submission.submitted_at).toLocaleString('en-RW')}</p></div><span className="mipc-status">{submission.grade===null?'Awaiting review':`${submission.grade}/${assignment.max_points}`}</span></div></div><div className="space-y-5 p-5"><section aria-label="Student submission"><h3 className="mipc-label flex items-center gap-2"><FileTextIcon className="h-4 w-4"/> Student response</h3><div className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-parchment-200 bg-white p-4 text-sm leading-6 text-ink-800">{submission.content||(submission.file_path?`Submitted file: ${submission.file_path}`:'No response text available.')}</div></section><form action={recordGrade} className="grid gap-4 sm:grid-cols-[140px_1fr]"><input type="hidden" name="submission_id" value={submission.id}/><div><label className="mipc-label">Mark (max {assignment.max_points})</label><input name="grade" type="number" min="0" max={assignment.max_points} step="0.5" required defaultValue={submission.grade??''} className="mipc-input"/></div><div><label className="mipc-label">Feedback</label><textarea name="feedback" rows={3} maxLength={5000} defaultValue={submission.feedback??''} className="mipc-input"/></div><button type="submit" className="mipc-button-primary sm:col-span-2 sm:justify-self-end"><CheckCircleIcon className="h-4 w-4"/> Record mark</button></form></div></article>})}
    </div>
    {submissions.length===0&&<div className="mipc-empty">There are no coursework submissions in this view.</div>}
    {totalPages>1&&<nav className="flex items-center justify-between gap-3"><Link className={`mipc-button-secondary ${page<=1?'pointer-events-none opacity-40':''}`} href={pageHref(Math.max(1,page-1))}>← Previous</Link><span className="text-sm font-semibold text-ink-700">Page {page} of {totalPages}</span><Link className={`mipc-button-secondary ${page>=totalPages?'pointer-events-none opacity-40':''}`} href={pageHref(Math.min(totalPages,page+1))}>Next →</Link></nav>}
  </div>;
}
