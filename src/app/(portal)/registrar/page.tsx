import Link from 'next/link';
import { AwardIcon, ChevronRightIcon, UsersIcon } from '@/components/icons';
import { requireActiveGovernanceRole } from '@/lib/governance-server';

export default async function RegistrarOverview() {
  const { admin } = await requireActiveGovernanceRole(['registrar','admin']);
  const [applications, students] = await Promise.all([
    admin.from('applications').select('id,status,enrolled_student_id'),
    admin.from('profiles').select('id,registration_status').eq('role','student')
  ]);
  if(applications.error||students.error) throw new Error('Registrar overview could not be loaded.');
  const apps:any[]=applications.data??[]; const rows:any[]=students.data??[];
  const awaiting=apps.filter((a)=>['pending','under_review'].includes(a.status)).length;
  const approved=apps.filter((a)=>a.status==='approved'&&!a.enrolled_student_id).length;
  const registered=rows.filter((s)=>s.registration_status==='registered').length;
  return <div className="space-y-8"><header><p className="mipc-eyebrow">Office of the Academic Registrar</p><h1 className="mipc-page-title">Student registration control</h1><p className="mt-2 max-w-3xl text-sm text-ink-700">The Registrar owns admission decisions and the official student register: registration number, programme department, year of study and registration standing. Class placement is passed to the HOD after registration.</p></header>
    <div className="grid gap-4 sm:grid-cols-3"><Metric label="Awaiting decision" value={awaiting}/><Metric label="Approved to register" value={approved}/><Metric label="Registered students" value={registered}/></div>
    <div className="grid gap-5 lg:grid-cols-2"><Link href="/registrar/applications" className="mipc-panel group p-6"><AwardIcon className="h-7 w-7 text-mipc-green-700"/><h2 className="mt-4 font-display text-2xl font-bold text-ink-950">Admissions & registration</h2><p className="mt-2 text-sm leading-6 text-ink-600">Review applications, approve or decline them, then issue the official registration number and academic programme placement.</p><span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-mipc-green-700">Open admissions <ChevronRightIcon className="h-4 w-4"/></span></Link><Link href="/registrar/students" className="mipc-panel group p-6"><UsersIcon className="h-7 w-7 text-mipc-green-700"/><h2 className="mt-4 font-display text-2xl font-bold text-ink-950">Authoritative student register</h2><p className="mt-2 text-sm leading-6 text-ink-600">Maintain registration status, registration number, department and year. HOD-assigned class placement is visible but not editable here.</p><span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-mipc-green-700">Open student register <ChevronRightIcon className="h-4 w-4"/></span></Link></div>
  </div>;
}
function Metric({label,value}:{label:string;value:number}){return <div className="mipc-panel p-5"><p className="text-3xl font-bold text-ink-950">{value}</p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-ink-600">{label}</p></div>}
