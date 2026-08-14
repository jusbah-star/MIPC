'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpenIcon, ClockIcon, ShieldCheckIcon, UsersIcon, FileTextIcon, CheckCircleIcon, BarChartIcon, MegaphoneIcon, PlusIcon, AwardIcon } from '@/components/icons';
import type { AccountRole } from '@/lib/roles';

interface NavItem { href: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string; }

const NAV_ITEMS: Record<AccountRole, NavItem[]> = {
  student: [
    { href: '/student', label: 'Overview', icon: BarChartIcon },
    { href: '/student/courses', label: 'My Courses', icon: BookOpenIcon },
    { href: '/student/finance', label: 'My Finance Status', icon: FileTextIcon },
    { href: '/student/tests', label: 'Examinations', icon: ClockIcon, badge: 'Live' },
    { href: '/student/assignments', label: 'Coursework', icon: FileTextIcon },
    { href: '/announcements', label: 'MIPC Bulletins', icon: MegaphoneIcon }
  ],
  lecturer: [
    { href: '/lecturer', label: 'Faculty Overview', icon: BarChartIcon },
    { href: '/lecturer/courses', label: 'My Courses & Rosters', icon: BookOpenIcon },
    { href: '/lecturer/tests/new', label: 'Assessment Builder', icon: PlusIcon },
    { href: '/lecturer/grading', label: 'Grading Center', icon: CheckCircleIcon, badge: 'Queue' },
    { href: '/lecturer/announcements', label: 'Post Bulletin', icon: MegaphoneIcon }
  ],
  hod: [
    { href: '/hod', label: 'Department Governance', icon: ShieldCheckIcon },
    { href: '/lecturer', label: 'Teaching Overview', icon: BarChartIcon },
    { href: '/lecturer/courses', label: 'My Courses & Rosters', icon: BookOpenIcon },
    { href: '/lecturer/tests/new', label: 'Assessment Builder', icon: PlusIcon },
    { href: '/lecturer/grading', label: 'Grading Center', icon: CheckCircleIcon }
  ],
  registrar: [
    { href: '/registrar', label: 'Registrar Overview', icon: AwardIcon },
    { href: '/registrar/applications', label: 'Admissions & Registration', icon: AwardIcon, badge: 'Review' },
    { href: '/registrar/cohorts', label: 'Cohorts & Intakes', icon: BookOpenIcon },
    { href: '/registrar/students', label: 'Student Register', icon: UsersIcon }
  ],
  finance: [
    { href: '/finance', label: 'Student Finance', icon: FileTextIcon }
  ],
  admin: [
    { href: '/admin', label: 'Principal Overview', icon: ShieldCheckIcon },
    { href: '/hod', label: 'Department Oversight', icon: BookOpenIcon },
    { href: '/registrar', label: 'Registrar Oversight', icon: AwardIcon },
    { href: '/finance', label: 'Finance Oversight', icon: FileTextIcon },
    { href: '/admin/applications', label: 'Admissions Pipeline', icon: AwardIcon },
    { href: '/admin/students', label: 'Student Registry', icon: UsersIcon },
    { href: '/admin/users', label: 'Staff & User Directory', icon: UsersIcon },
    { href: '/admin/announcements', label: 'Global Announcements', icon: MegaphoneIcon },
    { href: '/admin/courses', label: 'Curriculum & Cohorts', icon: BookOpenIcon },
    { href: '/admin/audit', label: 'Security & Audit Log', icon: FileTextIcon }
  ]
};

export default function PortalNav({ role, fullName, email, isDemo = false }: { role: AccountRole; fullName: string; email?: string; isDemo?: boolean }) {
  const pathname = usePathname(); const router = useRouter(); const links = NAV_ITEMS[role] || [];
  const handleRoleSwitch = (newRole: 'student' | 'lecturer' | 'admin') => { document.cookie = `mipc_demo_role=${newRole}; path=/; max-age=86400`; document.cookie = `ashcombe_demo_role=${newRole}; path=/; max-age=86400`; router.push(`/${newRole}`); router.refresh(); };
  return <div className="flex flex-col h-full justify-between"><div>
    <div className="px-3 py-4 mb-3 border-b border-ink-900/10"><Link href="/" className="flex items-center gap-3 group"><div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-ink-900/10 transition group-hover:ring-mipc-green-400/70"><img src="/api/mipc-logo" alt="Muhabura Integrated Polytechnic College crest" className="h-full w-full object-contain p-1" /></div><div><span className="block font-display font-bold text-ink-950 text-base leading-tight tracking-tight">MIPC Portal</span><span className="block font-mono text-[10px] tracking-wider uppercase text-mipc-green-700 font-bold">Musanze · Rwanda</span></div></Link></div>
    <div className="px-3 py-3 mx-1 mb-4 rounded-lg bg-parchment-100/70 border border-parchment-200"><div className="flex items-center justify-between mb-1"><span className="text-[11px] font-mono uppercase tracking-wider font-bold text-mipc-green-800">{role}</span><span className="inline-block w-2 h-2 rounded-full bg-signal-ok animate-pulse" /></div><p className="font-medium text-sm text-ink-950 truncate">{fullName}</p>{email && <p className="text-xs text-ink-700 truncate font-mono">{email}</p>}</div>
    <nav className="space-y-1 px-1"><div className="px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-ink-500 font-medium">Navigation</div>{links.map((item) => { const Icon=item.icon; const isActive=pathname===item.href || (item.href !== `/${role}` && pathname.startsWith(item.href)); return <Link key={item.href} href={item.href} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-ink-900 text-white shadow-sm' : 'text-ink-800 hover:bg-parchment-100 hover:text-ink-950'}`}><div className="flex items-center gap-2.5"><Icon className={`w-4 h-4 ${isActive ? 'text-mipc-green-400' : 'text-ink-500'}`} /><span>{item.label}</span></div>{item.badge && <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isActive ? 'bg-mipc-green-500/20 text-mipc-green-300' : 'bg-parchment-200 text-ink-700'}`}>{item.badge}</span>}</Link>; })}</nav>
  </div>{isDemo && <div className="pt-4 border-t border-ink-900/10 px-1 mt-6"><div className="px-2 py-1 mb-2 text-[10px] font-mono uppercase tracking-wider text-ink-500 font-semibold flex items-center justify-between"><span>Quick Switch Role</span><span className="text-mipc-green-700 font-bold">MIPC Demo</span></div><div className="grid grid-cols-3 gap-1 mb-4">{(['student','lecturer','admin'] as const).map((r)=><button key={r} onClick={()=>handleRoleSwitch(r)} className={`text-xs py-1.5 px-2 rounded font-mono font-medium capitalize transition-colors ${role===r?'bg-mipc-green-700 text-white shadow-xs':'bg-parchment-100 hover:bg-parchment-200 text-ink-800'}`}>{r}</button>)}</div></div>}</div>;
}
