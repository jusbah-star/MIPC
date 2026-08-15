import { HodStudentClassManager, type HodClassSection, type HodClassStudent } from '@/components/hod-student-class-manager';
import { ShieldCheckIcon, UsersIcon } from '@/components/icons';
import { requireActiveGovernanceRole } from '@/lib/governance-server';

type SearchParams = Record<string, string | string[] | undefined>;

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function safeSearch(value: string) {
  return value.replace(/[,%()'"*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export default async function HodStudentsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const { profile, admin } = await requireActiveGovernanceRole(['hod', 'admin']);
  const isPrincipal = profile.role === 'admin';

  const [departmentResult, cohortResult, sectionResult] = await Promise.all([
    admin.from('departments').select('id,name,code').order('name'),
    admin.from('cohorts').select('id,name,department_id,start_date').order('start_date', { ascending: false }),
    (admin as any).from('class_sections').select('id,name,cohort_id,department_id,year_of_study,capacity,is_active').order('year_of_study').order('name')
  ]);
  const baseError = departmentResult.error || cohortResult.error || sectionResult.error;
  if (baseError) throw new Error('Student class management data could not be loaded.');

  const departments: any[] = departmentResult.data ?? [];
  const allowedDepartmentIds = isPrincipal ? departments.map((item) => item.id) : [profile.department_id].filter(Boolean);
  const requestedDepartment = scalar(params.department);
  const departmentFilter = isPrincipal && allowedDepartmentIds.includes(requestedDepartment) ? requestedDepartment : '';
  const scopedDepartmentIds = departmentFilter ? [departmentFilter] : allowedDepartmentIds;

  const allCohorts: any[] = cohortResult.data ?? [];
  const allSections: any[] = sectionResult.data ?? [];
  const cohorts = allCohorts.filter((item) => scopedDepartmentIds.includes(item.department_id));
  const sections = allSections.filter((item) => scopedDepartmentIds.includes(item.department_id));

  const search = safeSearch(scalar(params.q));
  const yearValue = Number(scalar(params.year));
  const year = Number.isInteger(yearValue) && yearValue >= 1 && yearValue <= 8 ? yearValue : null;
  const requestedCohort = scalar(params.cohort);
  const cohortId = cohorts.some((item) => item.id === requestedCohort) ? requestedCohort : '';
  const requestedClass = scalar(params.class);
  const classId = sections.some((item) => item.id === requestedClass) ? requestedClass : '';
  const rawAssignment = scalar(params.assignment);
  const assignment = rawAssignment === 'assigned' || rawAssignment === 'unassigned' ? rawAssignment : 'all';
  const rawPerPage = Number(scalar(params.per_page));
  const perPage = rawPerPage === 50 ? 50 : 25;
  const requestedPage = Math.max(1, Number.parseInt(scalar(params.page) || '1', 10) || 1);

  function applyBaseScope(query: any) {
    query = query.eq('role', 'student').eq('registration_status', 'registered');
    if (scopedDepartmentIds.length === 1) query = query.eq('department_id', scopedDepartmentIds[0]);
    else if (scopedDepartmentIds.length > 1) query = query.in('department_id', scopedDepartmentIds);
    return query;
  }

  function applyFilters(query: any) {
    query = applyBaseScope(query);
    if (year) query = query.eq('year_of_study', year);
    if (cohortId) query = query.eq('cohort_id', cohortId);
    if (classId) query = query.eq('class_section_id', classId);
    if (!classId && assignment === 'assigned') query = query.not('class_section_id', 'is', null);
    if (!classId && assignment === 'unassigned') query = query.is('class_section_id', null);
    if (search) query = query.or(`full_name.ilike.%${search}%,registration_number.ilike.%${search}%`);
    return query;
  }

  if (scopedDepartmentIds.length === 0) {
    return <div className="mipc-empty">No department is available for class management.</div>;
  }

  const [countResult, summaryResult] = await Promise.all([
    applyFilters((admin as any).from('profiles').select('id', { count: 'exact', head: true })),
    applyBaseScope((admin as any).from('profiles').select('class_section_id'))
  ]);
  if (countResult.error || summaryResult.error) throw new Error('Registered students could not be counted.');

  const totalFiltered = countResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / perPage));
  const page = Math.min(requestedPage, totalPages);
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const studentResult = await applyFilters(
    (admin as any)
      .from('profiles')
      .select('id,full_name,registration_number,department_id,cohort_id,class_section_id,year_of_study')
  ).order('full_name').range(from, to);
  if (studentResult.error) throw new Error('Registered students could not be loaded.');

  const summaryRows: any[] = summaryResult.data ?? [];
  const assignedCount = summaryRows.filter((item) => item.class_section_id).length;
  const unassignedCount = summaryRows.length - assignedCount;
  const students: HodClassStudent[] = studentResult.data ?? [];
  const classSections: HodClassSection[] = sections.map((section) => {
    const cohort = cohorts.find((item) => item.id === section.cohort_id);
    const department = departments.find((item) => item.id === section.department_id);
    return {
      id: section.id,
      name: section.name,
      cohort_id: section.cohort_id,
      department_id: section.department_id,
      year_of_study: section.year_of_study,
      capacity: section.capacity,
      currentCount: summaryRows.filter((item) => item.class_section_id === section.id).length,
      cohortName: cohort?.name ?? 'Intake unavailable',
      departmentCode: department?.code ?? 'Department',
      is_active: Boolean(section.is_active)
    };
  });

  return (
    <div className="space-y-8">
      <header>
        <p className="mipc-eyebrow">Department governance</p>
        <h1 className="mipc-page-title">Students & Classes</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-700">Manage large intakes without rendering hundreds of student cards. Search and filter registered students, work in pages of 25 or 50, and assign selected students to a class in one atomic operation.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Registered in scope" value={summaryRows.length} icon={<UsersIcon className="h-5 w-5" />} />
        <Metric label="Unassigned" value={unassignedCount} icon={<ShieldCheckIcon className="h-5 w-5" />} />
        <Metric label="Assigned" value={assignedCount} icon={<ShieldCheckIcon className="h-5 w-5" />} />
        <Metric label="Active classes" value={classSections.filter((item) => item.is_active).length} icon={<UsersIcon className="h-5 w-5" />} />
      </div>

      <HodStudentClassManager
        students={students}
        sections={classSections}
        cohorts={cohorts.map((item) => ({ id: item.id, name: item.name, department_id: item.department_id }))}
        departments={departments.filter((item) => allowedDepartmentIds.includes(item.id))}
        filters={{
          q: search,
          year: year ? String(year) : '',
          cohort: cohortId,
          classId,
          assignment,
          department: departmentFilter,
          perPage
        }}
        page={page}
        totalPages={totalPages}
        totalFiltered={totalFiltered}
        assignedCount={assignedCount}
        unassignedCount={unassignedCount}
        isPrincipal={isPrincipal}
      />
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="mipc-panel flex items-center gap-4 p-5"><span className="rounded-xl bg-mipc-green-100 p-3 text-mipc-green-800">{icon}</span><div><p className="text-2xl font-bold text-ink-950">{value}</p><p className="text-xs uppercase tracking-wider text-ink-600">{label}</p></div></div>;
}
