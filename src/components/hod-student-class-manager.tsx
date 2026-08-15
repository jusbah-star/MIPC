'use client';

import { FormEvent, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { bulkAssignStudentsClassSection } from '@/app/(portal)/hod/actions';

export type HodClassStudent = {
  id: string;
  full_name: string;
  registration_number: string | null;
  department_id: string | null;
  cohort_id: string | null;
  class_section_id: string | null;
  year_of_study: number | null;
};

export type HodClassSection = {
  id: string;
  name: string;
  cohort_id: string;
  department_id: string;
  year_of_study: number;
  capacity: number;
  currentCount: number;
  cohortName: string;
  departmentCode: string;
  is_active: boolean;
};

type NamedOption = { id: string; name: string; department_id?: string | null };
type DepartmentOption = { id: string; name: string; code: string };

type Filters = {
  q: string;
  year: string;
  cohort: string;
  classId: string;
  assignment: string;
  department: string;
  perPage: number;
};

export function HodStudentClassManager({
  students,
  sections,
  cohorts,
  departments,
  filters,
  page,
  totalPages,
  totalFiltered,
  assignedCount,
  unassignedCount,
  isPrincipal
}: {
  students: HodClassStudent[];
  sections: HodClassSection[];
  cohorts: NamedOption[];
  departments: DepartmentOption[];
  filters: Filters;
  page: number;
  totalPages: number;
  totalFiltered: number;
  assignedCount: number;
  unassignedCount: number;
  isPrincipal: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetClassId, setTargetClassId] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'success' | 'error'; message?: string }>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();

  const targetClass = sections.find((section) => section.id === targetClassId) ?? null;
  const selectedStudents = useMemo(() => students.filter((student) => selected.has(student.id)), [students, selected]);
  const incompatibleCount = targetClass
    ? selectedStudents.filter((student) =>
        student.department_id !== targetClass.department_id ||
        student.year_of_study !== targetClass.year_of_study ||
        (student.cohort_id !== null && student.cohort_id !== targetClass.cohort_id)
      ).length
    : 0;
  const studentsEnteringTarget = targetClass
    ? selectedStudents.filter((student) => student.class_section_id !== targetClass.id).length
    : 0;
  const remainingPlaces = targetClass ? Math.max(0, targetClass.capacity - targetClass.currentCount) : 0;
  const capacityExceeded = Boolean(targetClass && studentsEnteringTarget > remainingPlaces);
  const allVisibleSelected = students.length > 0 && students.every((student) => selected.has(student.id));

  function toggleStudent(id: string) {
    setStatus({ kind: 'idle' });
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setStatus({ kind: 'idle' });
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) students.forEach((student) => next.delete(student.id));
      else students.forEach((student) => next.add(student.id));
      return next;
    });
  }

  function hrefWith(overrides: Partial<Record<'page' | 'assignment', string | number | null>>) {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.year) params.set('year', filters.year);
    if (filters.cohort) params.set('cohort', filters.cohort);
    if (filters.classId) params.set('class', filters.classId);
    if (filters.assignment && filters.assignment !== 'all') params.set('assignment', filters.assignment);
    if (filters.department) params.set('department', filters.department);
    if (filters.perPage !== 25) params.set('per_page', String(filters.perPage));
    for (const [key, value] of Object.entries(overrides)) {
      const queryKey = key === 'classId' ? 'class' : key;
      if (value === null || value === '' || value === 'all') params.delete(queryKey);
      else params.set(queryKey, String(value));
    }
    const query = params.toString();
    return `/hod/students${query ? `?${query}` : ''}`;
  }

  function submitBulk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetClass) {
      setStatus({ kind: 'error', message: 'Choose the destination class.' });
      return;
    }
    if (selected.size === 0) {
      setStatus({ kind: 'error', message: 'Select at least one student.' });
      return;
    }
    if (incompatibleCount > 0) {
      setStatus({ kind: 'error', message: `${incompatibleCount} selected student${incompatibleCount === 1 ? '' : 's'} do not match the destination class department, year, or intake.` });
      return;
    }
    if (capacityExceeded) {
      setStatus({ kind: 'error', message: `This move needs ${studentsEnteringTarget} place${studentsEnteringTarget === 1 ? '' : 's'}, but only ${remainingPlaces} remain in ${targetClass.name}.` });
      return;
    }

    const formData = new FormData();
    formData.set('class_section_id', targetClass.id);
    selected.forEach((id) => formData.append('student_ids', id));
    setStatus({ kind: 'idle' });
    startTransition(async () => {
      const result = await bulkAssignStudentsClassSection({ status: 'idle' }, formData);
      setStatus({ kind: result.status, message: result.message });
      if (result.status === 'success') {
        setSelected(new Set());
        setTargetClassId('');
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <section className="mipc-panel overflow-hidden">
        <div className="border-b border-parchment-200 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="mipc-eyebrow">Student class management</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-ink-950">Find students without loading the whole department</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-600">Search and filter on the server, show 25 or 50 students at a time, then select the visible students you want to move.</p>
            </div>
            <span className="mipc-status">{totalFiltered} matching</span>
          </div>
        </div>

        <form method="get" action="/hod/students" className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-7">
          <div className="sm:col-span-2 xl:col-span-2">
            <label className="mipc-label" htmlFor="student-search">Search</label>
            <input id="student-search" name="q" className="mipc-field" defaultValue={filters.q} placeholder="Name or registration number" maxLength={80} />
          </div>
          {isPrincipal && (
            <div>
              <label className="mipc-label" htmlFor="student-department">Department</label>
              <select id="student-department" name="department" className="mipc-field" defaultValue={filters.department}>
                <option value="">All departments</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.code} · {department.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="mipc-label" htmlFor="student-year">Year</label>
            <select id="student-year" name="year" className="mipc-field" defaultValue={filters.year}>
              <option value="">All years</option>
              {[1,2,3,4,5,6,7,8].map((year) => <option key={year} value={year}>Year {year}</option>)}
            </select>
          </div>
          <div>
            <label className="mipc-label" htmlFor="student-cohort">Intake</label>
            <select id="student-cohort" name="cohort" className="mipc-field" defaultValue={filters.cohort}>
              <option value="">All intakes</option>
              {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mipc-label" htmlFor="student-class">Current class</label>
            <select id="student-class" name="class" className="mipc-field" defaultValue={filters.classId}>
              <option value="">All classes</option>
              {sections.map((section) => <option key={section.id} value={section.id}>{section.name} · Y{section.year_of_study}</option>)}
            </select>
          </div>
          <div>
            <label className="mipc-label" htmlFor="student-per-page">Rows</label>
            <select id="student-per-page" name="per_page" className="mipc-field" defaultValue={String(filters.perPage)}>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </div>
          <input type="hidden" name="assignment" value={filters.assignment === 'all' ? '' : filters.assignment} />
          <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-7">
            <button className="mipc-button-primary !bg-mipc-green-700" type="submit">Apply filters</button>
            <Link className="mipc-button-secondary" href="/hod/students">Reset</Link>
          </div>
        </form>

        <div className="flex flex-wrap gap-2 border-t border-parchment-200 px-5 py-4">
          <Link href={hrefWith({ assignment: null, page: 1 })} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filters.assignment === 'all' ? 'bg-mipc-navy-950 text-white' : 'bg-parchment-100 text-ink-700'}`}>All</Link>
          <Link href={hrefWith({ assignment: 'unassigned', page: 1 })} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filters.assignment === 'unassigned' ? 'bg-mipc-navy-950 text-white' : 'bg-parchment-100 text-ink-700'}`}>Unassigned · {unassignedCount}</Link>
          <Link href={hrefWith({ assignment: 'assigned', page: 1 })} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filters.assignment === 'assigned' ? 'bg-mipc-navy-950 text-white' : 'bg-parchment-100 text-ink-700'}`}>Assigned · {assignedCount}</Link>
        </div>
      </section>

      <form onSubmit={submitBulk} className="mipc-panel overflow-hidden">
        <div className="grid gap-4 border-b border-parchment-200 bg-parchment-50 p-5 xl:grid-cols-[auto_1fr_auto] xl:items-end">
          <div>
            <p className="text-sm font-bold text-ink-950">{selected.size} selected on this page</p>
            <button type="button" onClick={toggleAllVisible} disabled={students.length === 0} className="mt-1 text-xs font-bold text-mipc-green-800 disabled:opacity-40">{allVisibleSelected ? 'Clear page selection' : `Select all ${students.length} visible students`}</button>
          </div>
          <div>
            <label className="mipc-label" htmlFor="bulk-class-section">Bulk assign to class</label>
            <select id="bulk-class-section" className="mipc-field" value={targetClassId} onChange={(event) => { setTargetClassId(event.target.value); setStatus({ kind: 'idle' }); }}>
              <option value="">Choose destination class</option>
              {sections.filter((section) => section.is_active).map((section) => {
                const remaining = Math.max(0, section.capacity - section.currentCount);
                return <option key={section.id} value={section.id} disabled={remaining === 0}>{section.name} · {section.departmentCode} · Year {section.year_of_study} · {section.currentCount}/{section.capacity}{remaining === 0 ? ' · Full' : ''}</option>;
              })}
            </select>
          </div>
          <button type="submit" className="mipc-button-primary !bg-mipc-green-700" disabled={pending || selected.size === 0 || !targetClass || incompatibleCount > 0 || capacityExceeded}>
            {pending ? 'Assigning…' : `Assign ${selected.size || ''} student${selected.size === 1 ? '' : 's'}`}
          </button>
          <div className="xl:col-span-3">
            {targetClass && <p className="text-xs text-ink-600">{targetClass.name}: {remainingPlaces} place{remainingPlaces === 1 ? '' : 's'} remaining. Students already in this class do not consume another place.</p>}
            {incompatibleCount > 0 && <p className="mt-2 rounded-xl bg-signal-warning-bg px-4 py-3 text-sm text-ink-800">{incompatibleCount} selected student{incompatibleCount === 1 ? '' : 's'} do not match this class. Filter by year/intake or choose another destination.</p>}
            {capacityExceeded && <p className="mt-2 rounded-xl bg-signal-danger-bg px-4 py-3 text-sm text-signal-danger">The selected move needs {studentsEnteringTarget} places, but this class has only {remainingPlaces} remaining.</p>}
            {status.message && <p className={`mt-2 rounded-xl px-4 py-3 text-sm ${status.kind === 'success' ? 'bg-signal-ok-bg text-signal-ok' : 'bg-signal-danger-bg text-signal-danger'}`}>{status.message}</p>}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white text-xs uppercase tracking-wider text-ink-500">
              <tr className="border-b border-parchment-200">
                <th className="w-12 px-5 py-3"><span className="sr-only">Select</span></th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Year / intake</th>
                <th className="px-4 py-3">Current class</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-parchment-200 bg-white">
              {students.map((student) => {
                const currentClass = sections.find((section) => section.id === student.class_section_id);
                const cohort = cohorts.find((item) => item.id === student.cohort_id);
                return (
                  <tr key={student.id} className={selected.has(student.id) ? 'bg-mipc-green-50/70' : ''}>
                    <td className="px-5 py-4 align-top"><input type="checkbox" name="student_ids" value={student.id} checked={selected.has(student.id)} onChange={() => toggleStudent(student.id)} className="h-4 w-4 accent-mipc-green-700" aria-label={`Select ${student.full_name}`} /></td>
                    <td className="px-4 py-4 align-top"><p className="font-semibold text-ink-950">{student.full_name}</p><p className="mt-1 font-mono text-xs text-ink-500">{student.registration_number ?? 'Registration number unavailable'}</p></td>
                    <td className="px-4 py-4 align-top"><p className="font-semibold text-ink-800">{student.year_of_study ? `Year ${student.year_of_study}` : 'Year not assigned'}</p><p className="mt-1 text-xs text-ink-500">{cohort?.name ?? 'Intake will follow class'}</p></td>
                    <td className="px-4 py-4 align-top"><span className="font-semibold text-ink-800">{currentClass?.name ?? 'Not assigned'}</span>{currentClass && <p className="mt-1 text-xs text-ink-500">{currentClass.currentCount}/{currentClass.capacity} students</p>}</td>
                    <td className="px-5 py-4 align-top"><span className={`mipc-status ${currentClass ? '' : '!bg-brass-400/15 !text-brass-700'}`}>{currentClass ? 'Assigned' : 'Needs class'}</span></td>
                  </tr>
                );
              })}
              {students.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-sm text-ink-600">No registered students match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-500">Page {page} of {Math.max(1, totalPages)} · {totalFiltered} matching students</p>
        <div className="flex gap-2">
          <Link href={hrefWith({ page: Math.max(1, page - 1) })} aria-disabled={page <= 1} className={`mipc-button-secondary ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}>Previous</Link>
          <Link href={hrefWith({ page: Math.min(Math.max(1, totalPages), page + 1) })} aria-disabled={page >= totalPages} className={`mipc-button-secondary ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}>Next</Link>
        </div>
      </div>
    </div>
  );
}
