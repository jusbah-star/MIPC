import type {
  Database,
  UserRole,
  QuestionOption
} from './database.types';

export const INITIAL_DEPARTMENTS: Database['public']['Tables']['departments']['Row'][] = [
  {
    id: 'dept-ict',
    name: 'Information & Communication Technology (ICT)',
    code: 'ICT',
    created_at: new Date('2024-01-01').toISOString()
  },
  {
    id: 'dept-civil',
    name: 'Civil Engineering & Building Construction',
    code: 'CIVIL',
    created_at: new Date('2024-01-01').toISOString()
  },
  {
    id: 'dept-elec',
    name: 'Electrical & Renewable Energy Technology',
    code: 'ELEC',
    created_at: new Date('2024-01-01').toISOString()
  },
  {
    id: 'dept-hosp',
    name: 'Hospitality & Tourism Management',
    code: 'HTM',
    created_at: new Date('2024-01-01').toISOString()
  },
  {
    id: 'dept-tss',
    name: 'Technical Secondary School & TVET Trades',
    code: 'TSS',
    created_at: new Date('2024-01-01').toISOString()
  }
];

export const INITIAL_COHORTS: Database['public']['Tables']['cohorts']['Row'][] = [
  {
    id: 'cohort-2026-ict',
    name: 'Class of 2026 (B-Tech Software Engineering)',
    department_id: 'dept-ict',
    start_date: '2023-09-01',
    end_date: '2026-07-30',
    created_at: new Date('2024-01-01').toISOString()
  },
  {
    id: 'cohort-2027-ict',
    name: 'Class of 2027 (B-Tech Network Technology)',
    department_id: 'dept-ict',
    start_date: '2024-09-01',
    end_date: '2027-07-30',
    created_at: new Date('2024-01-01').toISOString()
  },
  {
    id: 'cohort-2026-civil',
    name: 'Class of 2026 (B-Tech Civil Construction)',
    department_id: 'dept-civil',
    start_date: '2023-09-01',
    end_date: '2026-07-30',
    created_at: new Date('2024-01-01').toISOString()
  }
];

export const INITIAL_PROFILES: Database['public']['Tables']['profiles']['Row'][] = [
  {
    id: 'user-admin-1',
    role: 'admin',
    full_name: 'Rev. Dr. Laurent Shyaka',
    email: 'registrar@mipc.ac.rw',
    department_id: 'dept-ict',
    cohort_id: null,
    account_status: 'active',
    created_at: new Date('2024-01-01').toISOString()
  },
  {
    id: 'user-lecturer-1',
    role: 'lecturer',
    full_name: 'Eng. Dr. Emmanuel Ndayisaba',
    email: 'e.ndayisaba@mipc.ac.rw',
    department_id: 'dept-ict',
    cohort_id: null,
    account_status: 'active',
    created_at: new Date('2024-01-01').toISOString()
  },
  {
    id: 'user-student-1',
    role: 'student',
    full_name: 'Jean-Luc Habimana',
    email: 'j.habimana@mipc.ac.rw',
    department_id: 'dept-ict',
    cohort_id: 'cohort-2026-ict',
    account_status: 'active',
    created_at: new Date('2024-01-01').toISOString()
  },
  {
    id: 'user-student-2',
    role: 'student',
    full_name: 'Clarisse Uwase',
    email: 'c.uwase@mipc.ac.rw',
    department_id: 'dept-ict',
    cohort_id: 'cohort-2026-ict',
    account_status: 'active',
    created_at: new Date('2024-01-01').toISOString()
  }
];

export const INITIAL_COURSES: Database['public']['Tables']['courses']['Row'][] = [
  {
    id: 'course-ict201',
    code: 'ICT201',
    title: 'Full-Stack Web & Database Engineering',
    description: 'Modern web architecture, Next.js, relational database modeling with PostgreSQL, API design, and cloud deployment.',
    department_id: 'dept-ict',
    cohort_id: 'cohort-2026-ict',
    lecturer_id: 'user-lecturer-1',
    credits: 4,
    created_at: new Date('2024-01-01').toISOString()
  },
  {
    id: 'course-ict304',
    code: 'ICT304',
    title: 'Computer Networks, Routing & Network Security',
    description: 'IP subnetting, Cisco packet routing, VLAN configurations, firewall policies, and secure enterprise communications.',
    department_id: 'dept-ict',
    cohort_id: 'cohort-2026-ict',
    lecturer_id: 'user-lecturer-1',
    credits: 4,
    created_at: new Date('2024-01-01').toISOString()
  },
  {
    id: 'course-civ101',
    code: 'CIV101',
    title: 'Structural Mechanics & Building Materials',
    description: 'Stress-strain relationships, reinforced concrete design, soil mechanics, and Rwandan building standards.',
    department_id: 'dept-civil',
    cohort_id: 'cohort-2026-civil',
    lecturer_id: 'user-lecturer-1',
    credits: 4,
    created_at: new Date('2024-01-01').toISOString()
  }
];

export const INITIAL_ENROLLMENTS: Database['public']['Tables']['enrollments']['Row'][] = [
  {
    id: 'enr-1',
    student_id: 'user-student-1',
    course_id: 'course-ict201',
    status: 'active',
    enrolled_at: new Date('2024-09-01').toISOString()
  },
  {
    id: 'enr-2',
    student_id: 'user-student-1',
    course_id: 'course-ict304',
    status: 'active',
    enrolled_at: new Date('2024-09-01').toISOString()
  },
  {
    id: 'enr-3',
    student_id: 'user-student-2',
    course_id: 'course-ict201',
    status: 'active',
    enrolled_at: new Date('2024-09-01').toISOString()
  }
];

const now = new Date();
const pastDate = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
const futureDate = new Date(now.getTime() + 14 * 24 * 3600 * 1000).toISOString();

export const INITIAL_TESTS: Database['public']['Tables']['tests']['Row'][] = [
  {
    id: 'test-ict201-midterm',
    course_id: 'course-ict201',
    lecturer_id: 'user-lecturer-1',
    title: 'ICT201 Midterm Examination: Web Architecture & Database Design',
    description: 'Comprehensive polytechnic examination covering RESTful API architecture, SQL schema optimization, and security invariants.',
    duration_minutes: 45,
    passing_score: 50,
    available_from: pastDate,
    available_until: futureDate,
    published: true,
    created_at: pastDate
  },
  {
    id: 'test-ict304-quiz1',
    course_id: 'course-ict304',
    lecturer_id: 'user-lecturer-1',
    title: 'ICT304 Practical Quiz: Subnetting & Network Topologies',
    description: 'Timed assessment evaluating CIDR notation, default gateways, and dynamic routing protocols (OSPF).',
    duration_minutes: 30,
    passing_score: 50,
    available_from: pastDate,
    available_until: futureDate,
    published: true,
    created_at: pastDate
  }
];

export const INITIAL_QUESTIONS: Database['public']['Tables']['questions']['Row'][] = [
  {
    id: 'q-1',
    test_id: 'test-ict201-midterm',
    type: 'mcq',
    prompt: 'In relational database design, which normal form (NF) eliminates transitive dependencies between non-key attributes?',
    options: [
      { id: 'a', label: 'First Normal Form (1NF)' },
      { id: 'b', label: 'Second Normal Form (2NF)' },
      { id: 'c', label: 'Third Normal Form (3NF)' },
      { id: 'd', label: 'Boyce-Codd Normal Form (BCNF)' }
    ],
    correct_answer: 'c',
    points: 5,
    order_index: 0
  },
  {
    id: 'q-2',
    test_id: 'test-ict201-midterm',
    type: 'mcq',
    prompt: 'Which HTTP status code is designated by RFC 9110 to represent a successful resource creation on the server?',
    options: [
      { id: 'a', label: '200 OK' },
      { id: 'b', label: '201 Created' },
      { id: 'c', label: '204 No Content' },
      { id: 'd', label: '304 Not Modified' }
    ],
    correct_answer: 'b',
    points: 5,
    order_index: 1
  },
  {
    id: 'q-3',
    test_id: 'test-ict201-midterm',
    type: 'short_answer',
    prompt: 'What security mechanism in web browsers restricts scripts running in one origin from interacting with resources from a different origin?',
    options: null,
    correct_answer: 'Same-Origin Policy',
    points: 5,
    order_index: 2
  },
  {
    id: 'q-4',
    test_id: 'test-ict201-midterm',
    type: 'essay',
    prompt: 'Explain the principles of ACID in database transaction management. Discuss how row-level locking ensures data consistency in multi-user institutional polytechnic management systems.',
    options: null,
    correct_answer: null,
    points: 15,
    order_index: 3
  },
  {
    id: 'q-5',
    test_id: 'test-ict304-quiz1',
    type: 'mcq',
    prompt: 'Given the network address 192.168.10.0/26, how many usable host IP addresses are available in this subnet?',
    options: [
      { id: 'a', label: '62 hosts' },
      { id: 'b', label: '64 hosts' },
      { id: 'c', label: '126 hosts' },
      { id: 'd', label: '30 hosts' }
    ],
    correct_answer: 'a',
    points: 10,
    order_index: 0
  },
  {
    id: 'q-6',
    test_id: 'test-ict304-quiz1',
    type: 'short_answer',
    prompt: 'Which interior gateway protocol uses Dijkstra’s Shortest Path First (SPF) algorithm to calculate loop-free network routes?',
    options: null,
    correct_answer: 'OSPF',
    points: 10,
    order_index: 1
  }
];

export const INITIAL_ASSIGNMENTS: Database['public']['Tables']['assignments']['Row'][] = [
  {
    id: 'assign-1',
    course_id: 'course-ict201',
    title: 'Lab Project 2: Polytechnic Student Registration & Database Backend',
    description: 'Design and deploy a modular REST API with PostgreSQL connection pooling, password hashing (Argon2/bcrypt), and role-based authorization.',
    due_date: new Date(now.getTime() + 5 * 24 * 3600 * 1000).toISOString(),
    max_points: 100,
    created_at: pastDate
  },
  {
    id: 'assign-2',
    course_id: 'course-ict304',
    title: 'Network Simulation: Enterprise Campus Subnetting & VLAN Configuration',
    description: 'Build a Cisco Packet Tracer simulation connecting MIPC Musanze Campus faculties across VLAN 10 (ICT), VLAN 20 (Engineering), and VLAN 30 (Administration).',
    due_date: new Date(now.getTime() + 12 * 24 * 3600 * 1000).toISOString(),
    max_points: 100,
    created_at: pastDate
  }
];

export const INITIAL_COURSE_MATERIALS: Database['public']['Tables']['course_materials']['Row'][] = [
  {
    id: 'material-ict201-1',
    course_id: 'course-ict201',
    title: 'Database design practical guide',
    description: 'Reference notes for normalization, indexing and transaction design.',
    material_type: 'note',
    resource_url: null,
    content: 'Review normal forms, foreign-key indexing, row-level security and short transaction boundaries before the practical session.',
    published: true,
    created_by: 'user-lecturer-1',
    created_at: pastDate,
    updated_at: pastDate
  }
];

export const INITIAL_SUBMISSIONS: Database['public']['Tables']['submissions']['Row'][] = [
  {
    id: 'sub-1',
    course_id: 'course-ict201',
    student_id: 'user-student-1',
    assignment_id: 'assign-1',
    assignment_title: 'Lab Project 2: Polytechnic Student Registration & Database Backend',
    file_path: 'assignments/ict201/habimana_lab2_solution.zip',
    content: null,
    submitted_at: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
    grade: 96,
    feedback: 'Outstanding schema normalization, robust input validation, and clean Docker compose setup. Commendable work.',
    graded_by: 'user-lecturer-1',
    graded_at: new Date(now.getTime() - 1 * 3600 * 1000).toISOString()
  }
];

export const INITIAL_APPLICATIONS: Database['public']['Tables']['applications']['Row'][] = [
  {
    id: 'app-1',
    full_name: 'Aline Mukamana',
    email: 'aline.mukamana@gmail.com',
    phone: '+250 788 123 456',
    department_id: 'dept-ict',
    status: 'pending',
    documents_path: 'admissions/2026/mukamana_transcripts.pdf',
    submitted_at: new Date(now.getTime() - 18 * 3600 * 1000).toISOString(),
    reviewed_by: null,
    reviewed_at: null,
    statement: 'I want to build practical digital systems that improve public services in Rwanda.',
    privacy_consent_at: new Date(now.getTime() - 18 * 3600 * 1000).toISOString()
  },
  {
    id: 'app-2',
    full_name: 'Patrick Nshimiyimana',
    email: 'p.nshimiyimana@musanze-tvet.rw',
    phone: '+250 785 456 789',
    department_id: 'dept-civil',
    status: 'under_review',
    documents_path: 'admissions/2026/nshimiyimana_portfolio.pdf',
    submitted_at: new Date(now.getTime() - 36 * 3600 * 1000).toISOString(),
    reviewed_by: 'user-admin-1',
    reviewed_at: new Date(now.getTime() - 12 * 3600 * 1000).toISOString(),
    statement: null,
    privacy_consent_at: new Date(now.getTime() - 36 * 3600 * 1000).toISOString()
  },
  {
    id: 'app-3',
    full_name: 'Diane Ingabire',
    email: 'diane.ingabire.rw@gmail.com',
    phone: '+250 790 987 654',
    department_id: 'dept-elec',
    status: 'approved',
    documents_path: 'admissions/2026/ingabire_dossier.pdf',
    submitted_at: new Date(now.getTime() - 72 * 3600 * 1000).toISOString(),
    reviewed_by: 'user-admin-1',
    reviewed_at: new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
    statement: null,
    privacy_consent_at: new Date(now.getTime() - 72 * 3600 * 1000).toISOString()
  }
];

export const INITIAL_ANNOUNCEMENTS: Database['public']['Tables']['announcements']['Row'][] = [
  {
    id: 'ann-1',
    scope: 'public',
    course_id: null,
    title: 'Muhabura Integrated Polytechnic College (MIPC): 2026/2027 Academic Year Admissions Now Open',
    body: 'The Office of the Academic Registrar invites applications for B-Tech degrees, TVET Advanced Diplomas, and Technical Secondary School (TSS) certificates in ICT, Civil Engineering, Electrical Technology, and Hospitality.',
    author_id: 'user-admin-1',
    published_at: new Date(now.getTime() - 48 * 3600 * 1000).toISOString()
  },
  {
    id: 'ann-2',
    scope: 'college',
    course_id: null,
    title: 'Innovation Hub & Modern Computer Laboratories: 24/7 Practical Session Schedule',
    body: 'MIPC computer labs and engineering fabrication workshops in Musanze campus will remain accessible around the clock for project prototyping and practical exams.',
    author_id: 'user-admin-1',
    published_at: new Date(now.getTime() - 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'ann-3',
    scope: 'course',
    course_id: 'course-ict201',
    title: 'ICT201: Lab Demonstration moved to Main Computer Lab 2 (Musanze Campus)',
    body: 'Please note that Friday practical session on Dockerized Microservices has relocated to Main Lab 2 for high-speed fiber connectivity.',
    author_id: 'user-lecturer-1',
    published_at: new Date(now.getTime() - 12 * 3600 * 1000).toISOString()
  }
];

export const INITIAL_AUDIT_LOGS: Database['public']['Tables']['audit_log']['Row'][] = [
  {
    id: 1,
    actor_id: 'user-admin-1',
    action: 'application.approve',
    target_table: 'applications',
    target_id: 'app-3',
    old_value: { status: 'pending' },
    new_value: { status: 'approved' },
    created_at: new Date(now.getTime() - 24 * 3600 * 1000).toISOString()
  },
  {
    id: 2,
    actor_id: 'user-lecturer-1',
    action: 'grade.update',
    target_table: 'submissions',
    target_id: 'sub-1',
    old_value: { grade: null },
    new_value: { grade: 96 },
    created_at: new Date(now.getTime() - 1 * 3600 * 1000).toISOString()
  }
];
