'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AcademicCapIcon,
  BookOpenIcon,
  ClockIcon,
  ShieldCheckIcon,
  UsersIcon,
  FileTextIcon,
  CheckCircleIcon,
  BarChartIcon,
  MegaphoneIcon,
  PlusIcon,
  AwardIcon
} from '@/components/icons';
import type { UserRole } from '@/lib/database.types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  student: [
    { href: '/student', label: 'Overview', icon: BarChartIcon },
    { href: '/student/courses', label: 'My courses', icon: BookOpenIcon },
    { href: '/student/tests', label: 'Examinations', icon: ClockIcon, badge: 'Live' },
    { href: '/student/assignments', label: 'Coursework', icon: FileTextIcon },
    { href: '/announcements', label: 'Campus news', icon: MegaphoneIcon }
  ],
  lecturer: [
    { href: '/lecturer', label: 'Overview', icon: BarChartIcon },
    { href: '/lecturer/courses', label: 'Courses & rosters', icon: BookOpenIcon },
    { href: '/lecturer/tests/new', label: 'Assessment builder', icon: PlusIcon },
    { href: '/lecturer/grading', label: 'Grading centre', icon: CheckCircleIcon, badge: 'Queue' },
    { href: '/lecturer/announcements', label: 'Publish news', icon: MegaphoneIcon }
  ],
  admin: [
    { href: '/admin', label: 'Overview', icon: ShieldCheckIcon },
    { href: '/admin/applications', label: 'Admissions', icon: AwardIcon, badge: 'Review' },
    { href: '/admin/users', label: 'People & access', icon: UsersIcon },
    { href: '/admin/announcements', label: 'Announcements', icon: MegaphoneIcon },
    { href: '/admin/courses', label: 'Curriculum & cohorts', icon: BookOpenIcon },
    { href: '/admin/audit', label: 'Audit & security', icon: FileTextIcon }
  ]
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function PortalNav({
  role,
  fullName,
  email,
  isDemo = false,
  compact = false
}: {
  role: UserRole;
  fullName: string;
  email?: string;
  isDemo?: boolean;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const links = NAV_ITEMS[role] || [];

  const handleRoleSwitch = (newRole: UserRole) => {
    document.cookie = `mipc_demo_role=${newRole}; path=/; max-age=86400`;
    document.cookie = `ashcombe_demo_role=${newRole}; path=/; max-age=86400`;
    router.push(`/${newRole}`);
    router.refresh();
  };

  return (
    <div className="flex h-full flex-col">
      <Link href="/" className={`group flex items-center gap-3 rounded-xl px-2 py-2 ${compact ? 'mb-4' : 'mb-6'}`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-mipc-green-900 shadow-academic transition group-hover:-translate-y-px">
          <AcademicCapIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-base font-extrabold leading-tight tracking-[-0.025em] text-white">MIPC</span>
          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.13em] text-white/45">Digital Campus</span>
        </span>
      </Link>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.06] p-3.5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-xs font-bold text-white">
            {initials(fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{fullName}</p>
            <p className="mt-0.5 truncate text-xs text-white/45">{email || `${role}@mipc.ac.rw`}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/[0.08] pt-3">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold capitalize text-white/70">{role}</span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-mipc-green-300">
            <span className="h-1.5 w-1.5 rounded-full bg-mipc-green-300" /> Active
          </span>
        </div>
      </div>

      <nav aria-label={`${role} portal navigation`} className="space-y-1">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Workspace</p>
        {links.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== `/${role}` && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`group flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-200 ${
                isActive
                  ? 'bg-white text-ink-950 shadow-academic'
                  : 'text-white/65 hover:bg-white/[0.07] hover:text-white'
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-mipc-green-700' : 'text-white/40 group-hover:text-white/70'}`} />
                <span className="truncate">{item.label}</span>
              </span>
              {item.badge ? (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive ? 'bg-mipc-green-50 text-mipc-green-700' : 'bg-white/10 text-white/55'}`}>
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {isDemo ? (
        <div className="mt-auto pt-8">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Demo role</span>
              <span className="rounded-full bg-mipc-green-400/15 px-2 py-0.5 text-[10px] font-semibold text-mipc-green-300">Local only</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {(['student', 'lecturer', 'admin'] as UserRole[]).map((itemRole) => (
                <button
                  key={itemRole}
                  type="button"
                  onClick={() => handleRoleSwitch(itemRole)}
                  className={`rounded-lg px-2 py-2 text-[11px] font-semibold capitalize transition ${
                    role === itemRole ? 'bg-white text-ink-950' : 'bg-white/[0.06] text-white/55 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {itemRole}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
