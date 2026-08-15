export type AccountRole = 'student' | 'lecturer' | 'hod' | 'registrar' | 'finance' | 'admin';
export type LoginPortal = 'student' | 'staff' | 'admin';

export type Profile = {
  id: string;
  role: AccountRole;
  full_name: string;
  email: string;
  account_status: 'active' | 'suspended';
  department_id: string | null;
  cohort_id: string | null;
  registration_number?: string | null;
  year_of_study?: number | null;
  class_section_id?: string | null;
};

export type Course = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  credits: number | null;
};

export type Material = {
  id: string;
  title: string;
  description: string | null;
  material_category?: string | null;
  resource_url: string | null;
  content: string | null;
  file_name?: string | null;
  created_at: string;
};

export type Exam = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  available_from: string;
  available_until: string;
  published: boolean;
};
