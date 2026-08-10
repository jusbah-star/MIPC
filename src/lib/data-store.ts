import 'server-only';

import {
  INITIAL_DEPARTMENTS,
  INITIAL_COHORTS,
  INITIAL_PROFILES,
  INITIAL_COURSES,
  INITIAL_ENROLLMENTS,
  INITIAL_TESTS,
  INITIAL_QUESTIONS,
  INITIAL_COURSE_MATERIALS,
  INITIAL_ASSIGNMENTS,
  INITIAL_SUBMISSIONS,
  INITIAL_APPLICATIONS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_AUDIT_LOGS
} from './mock-data';
import type {
  Database,
  UserRole,
  ApplicationStatus,
  AnnouncementScope,
  QuestionType,
  AttemptStatus
} from './database.types';

// In-memory persistent state during server runtime
class Store {
  departments = [...INITIAL_DEPARTMENTS];
  cohorts = [...INITIAL_COHORTS];
  profiles = [...INITIAL_PROFILES];
  courses = [...INITIAL_COURSES];
  enrollments = [...INITIAL_ENROLLMENTS];
  tests = [...INITIAL_TESTS];
  questions = [...INITIAL_QUESTIONS];
  course_materials = [...INITIAL_COURSE_MATERIALS];
  test_attempts: Database['public']['Tables']['test_attempts']['Row'][] = [];
  answers: Database['public']['Tables']['answers']['Row'][] = [];
  assignments = [...INITIAL_ASSIGNMENTS];
  submissions = [...INITIAL_SUBMISSIONS];
  applications = [...INITIAL_APPLICATIONS];
  announcements = [...INITIAL_ANNOUNCEMENTS];
  audit_log = [...INITIAL_AUDIT_LOGS];

  get audit_logs() {
    return this.audit_log;
  }

  // Auth / Active session simulation
  currentUser: Database['public']['Tables']['profiles']['Row'] | null = INITIAL_PROFILES[2]; // Default to student Alex Mercer
}

const globalForStore = globalThis as unknown as { appStore: Store | undefined };
export const dataStore = globalForStore.appStore ?? new Store();
if (process.env.NODE_ENV !== 'production') globalForStore.appStore = dataStore;

// Helpers for store actions
export function getStore() {
  return dataStore;
}

export function getCurrentProfile(userId?: string) {
  if (userId) {
    return dataStore.profiles.find((p) => p.id === userId) ?? null;
  }
  return dataStore.currentUser;
}

export function setCurrentProfileByRole(role: UserRole) {
  const profile = dataStore.profiles.find((p) => p.role === role);
  if (profile) {
    dataStore.currentUser = profile;
  }
  return profile;
}

export function setCurrentProfileById(userId: string) {
  const profile = dataStore.profiles.find((p) => p.id === userId);
  if (profile) {
    dataStore.currentUser = profile;
  }
  return profile;
}

// ---------------------------------------------------------------------------
// Business Operations
// ---------------------------------------------------------------------------

export async function submitApplication(data: {
  full_name: string;
  email: string;
  phone?: string | null;
  department_id?: string | null;
  statement?: string | null;
}) {
  const newApp: any = {
    id: `app-${Date.now()}`,
    full_name: data.full_name,
    email: data.email,
    phone: data.phone ?? null,
    department_id: data.department_id ?? null,
    statement: data.statement ?? null,
    status: 'pending',
    documents_path: null,
    submitted_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
  dataStore.applications.unshift(newApp);
  return newApp;
}

export async function approveApplication(applicationId: string, reviewerId: string = 'user-admin-1') {
  const app = dataStore.applications.find((a) => a.id === applicationId);
  if (!app) throw new Error('Application not found');

  app.status = 'approved';
  app.reviewed_by = reviewerId;
  app.reviewed_at = new Date().toISOString();

  // Create student profile
  const newStudentId = `user-student-${Date.now()}`;
  const newProfile: Database['public']['Tables']['profiles']['Row'] = {
    id: newStudentId,
    role: 'student',
    full_name: app.full_name,
    email: app.email,
    department_id: app.department_id,
    cohort_id: 'cohort-2026-cs',
    account_status: 'active',
    created_at: new Date().toISOString()
  };
  dataStore.profiles.push(newProfile);

  // Auto-enroll in introductory departmental courses
  const deptCourses = dataStore.courses.filter((c) => c.department_id === app.department_id);
  deptCourses.forEach((c) => {
    dataStore.enrollments.push({
      id: `enr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      student_id: newStudentId,
      course_id: c.id,
      status: 'active',
      enrolled_at: new Date().toISOString()
    });
  });

  // Log audit
  dataStore.audit_log.unshift({
    id: dataStore.audit_log.length + 1,
    actor_id: reviewerId,
    action: 'application.approve',
    target_table: 'applications',
    target_id: applicationId,
    old_value: { status: 'pending' },
    new_value: { status: 'approved', student_id: newStudentId },
    created_at: new Date().toISOString()
  });

  return { profile: newProfile, application: app };
}

export const approveApplicationInStore = approveApplication;

export async function rejectApplication(applicationId: string, reviewerId: string = 'user-admin-1') {
  const app = dataStore.applications.find((a) => a.id === applicationId);
  if (!app) throw new Error('Application not found');

  const oldStatus = app.status;
  app.status = 'rejected';
  app.reviewed_by = reviewerId;
  app.reviewed_at = new Date().toISOString();

  dataStore.audit_log.unshift({
    id: dataStore.audit_log.length + 1,
    actor_id: reviewerId,
    action: 'application.reject',
    target_table: 'applications',
    target_id: applicationId,
    old_value: { status: oldStatus },
    new_value: { status: 'rejected' },
    created_at: new Date().toISOString()
  });

  return app;
}

export const rejectApplicationInStore = rejectApplication;

export function saveAnswerDraft(attemptId: string, questionId: string, response: string) {
  const existing = dataStore.answers.find((a) => a.attempt_id === attemptId && a.question_id === questionId);
  if (existing) {
    existing.response = response;
  } else {
    dataStore.answers.push({
      attempt_id: attemptId,
      question_id: questionId,
      response
    } as any);
  }
}

export function submitAssignmentSolution(assignmentId: string, studentId: string, content: string) {
  const existing = dataStore.submissions.find((s) => s.assignment_id === assignmentId && s.student_id === studentId);
  if (existing) {
    (existing as any).content = content;
    existing.submitted_at = new Date().toISOString();
    existing.grade = null;
    return existing;
  }

  const newSub: any = {
    id: `sub-${Date.now()}`,
    assignment_id: assignmentId,
    student_id: studentId,
    content,
    grade: null,
    feedback: null,
    graded_by: null,
    graded_at: null,
    submitted_at: new Date().toISOString()
  };
  dataStore.submissions.unshift(newSub);
  return newSub;
}

export function addAnnouncement(data: {
  scope: AnnouncementScope;
  course_id?: string | null;
  title: string;
  body: string;
  author_id?: string;
}) {
  const newAnn: Database['public']['Tables']['announcements']['Row'] = {
    id: `ann-${Date.now()}`,
    scope: data.scope,
    course_id: data.course_id ?? null,
    title: data.title,
    body: data.body,
    author_id: data.author_id ?? 'user-lecturer-1',
    published_at: new Date().toISOString()
  };
  dataStore.announcements.unshift(newAnn);
  return newAnn;
}

export const publishAnnouncement = addAnnouncement;

export function gradeAssignmentSubmission(
  submissionId: string,
  grade: number,
  feedback: string,
  graderId: string = 'user-lecturer-1'
) {
  const sub = dataStore.submissions.find((s) => s.id === submissionId);
  if (!sub) throw new Error('Submission not found');

  const oldGrade = sub.grade;
  sub.grade = grade;
  sub.feedback = feedback;
  sub.graded_by = graderId;
  sub.graded_at = new Date().toISOString();

  dataStore.audit_log.unshift({
    id: dataStore.audit_log.length + 1,
    actor_id: graderId,
    action: 'grade.update',
    target_table: 'submissions',
    target_id: submissionId,
    old_value: { grade: oldGrade },
    new_value: { grade, feedback },
    created_at: new Date().toISOString()
  });

  return sub;
}

export const gradeSubmission = gradeAssignmentSubmission;

export function createTestWithQuestions(data: {
  course_id: string;
  lecturer_id?: string;
  title: string;
  description?: string | null;
  duration_minutes: number;
  passing_score?: number;
  available_from: string;
  available_until: string;
  published?: boolean;
  questions: {
    type: QuestionType;
    prompt: string;
    options?: { id: string; label: string }[] | null;
    correct_answer?: string | null;
    points: number;
    order_index: number;
  }[];
}) {
  const newTestId = `test-${Date.now()}`;
  const newTest: any = {
    id: newTestId,
    course_id: data.course_id,
    lecturer_id: data.lecturer_id ?? 'user-lecturer-1',
    title: data.title,
    description: data.description ?? null,
    duration_minutes: data.duration_minutes,
    passing_score: data.passing_score ?? 70,
    available_from: data.available_from,
    available_until: data.available_until,
    published: data.published ?? true,
    created_at: new Date().toISOString()
  };
  dataStore.tests.unshift(newTest);

  const newQuestions: Database['public']['Tables']['questions']['Row'][] = data.questions.map((q, idx) => ({
    id: `q-${newTestId}-${idx + 1}`,
    test_id: newTestId,
    type: q.type,
    prompt: q.prompt,
    options: q.options ?? null,
    correct_answer: q.correct_answer ?? null,
    points: q.points,
    order_index: q.order_index ?? idx
  }));

  dataStore.questions.push(...newQuestions);

  dataStore.audit_log.unshift({
    id: dataStore.audit_log.length + 1,
    actor_id: data.lecturer_id ?? 'user-lecturer-1',
    action: 'test.create',
    target_table: 'tests',
    target_id: newTestId,
    old_value: null,
    new_value: { title: newTest.title, question_count: newQuestions.length },
    created_at: new Date().toISOString()
  });

  return { test: newTest, questions: newQuestions };
}
