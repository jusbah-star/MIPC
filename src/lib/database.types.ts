export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'student' | 'lecturer' | 'admin';
export type AccountStatus = 'active' | 'suspended';
export type MaterialType = 'document' | 'link' | 'note';
export type EnrollmentStatus = 'active' | 'dropped' | 'completed';
export type ApplicationStatus = 'pending' | 'under_review' | 'approved' | 'rejected';
export type AnnouncementScope = 'public' | 'college' | 'course';
export type QuestionType = 'mcq' | 'short_answer' | 'essay';
export type AttemptStatus = 'in_progress' | 'submitted' | 'auto_submitted' | 'graded';
export type DataRequestType = 'access' | 'rectification' | 'restriction' | 'erasure' | 'portability' | 'objection';
export type DataRequestStatus = 'received' | 'identity_verification' | 'in_review' | 'completed' | 'declined';

export interface QuestionOption {
  id: string;
  label: string;
}

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string;
          name: string;
          code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['departments']['Insert']>;
      };
      cohorts: {
        Row: {
          id: string;
          name: string;
          department_id: string;
          start_date: string;
          end_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          department_id: string;
          start_date: string;
          end_date?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['cohorts']['Insert']>;
      };
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string;
          email: string;
          department_id: string | null;
          cohort_id: string | null;
          account_status: AccountStatus;
          created_at: string;
        };
        Insert: {
          id: string;
          role: UserRole;
          full_name: string;
          email: string;
          department_id?: string | null;
          cohort_id?: string | null;
          account_status?: AccountStatus;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      courses: {
        Row: {
          id: string;
          code: string;
          title: string;
          description: string | null;
          department_id: string;
          cohort_id: string | null;
          lecturer_id: string | null;
          credits: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          title: string;
          description?: string | null;
          department_id: string;
          cohort_id?: string | null;
          lecturer_id?: string | null;
          credits?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['courses']['Insert']>;
      };
      enrollments: {
        Row: {
          id: string;
          student_id: string;
          course_id: string;
          status: EnrollmentStatus;
          enrolled_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          course_id: string;
          status?: EnrollmentStatus;
          enrolled_at?: string;
        };
        Update: Partial<Database['public']['Tables']['enrollments']['Insert']>;
      };
      course_materials: {
        Row: {
          id: string;
          course_id: string;
          title: string;
          description: string | null;
          material_type: MaterialType;
          resource_url: string | null;
          content: string | null;
          published: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          description?: string | null;
          material_type?: MaterialType;
          resource_url?: string | null;
          content?: string | null;
          published?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['course_materials']['Insert']>;
      };
      applications: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string | null;
          department_id: string | null;
          status: ApplicationStatus;
          documents_path: string | null;
          submitted_at: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          statement: string | null;
          privacy_consent_at: string | null;
        };
        Insert: {
          id?: string;
          full_name: string;
          email: string;
          phone?: string | null;
          department_id?: string | null;
          status?: ApplicationStatus;
          documents_path?: string | null;
          submitted_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          statement?: string | null;
          privacy_consent_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['applications']['Insert']>;
      };
      announcements: {
        Row: {
          id: string;
          scope: AnnouncementScope;
          course_id: string | null;
          title: string;
          body: string;
          author_id: string;
          published_at: string;
        };
        Insert: {
          id?: string;
          scope: AnnouncementScope;
          course_id?: string | null;
          title: string;
          body: string;
          author_id: string;
          published_at?: string;
        };
        Update: Partial<Database['public']['Tables']['announcements']['Insert']>;
      };
      tests: {
        Row: {
          id: string;
          course_id: string;
          lecturer_id: string;
          title: string;
          description: string | null;
          duration_minutes: number;
          available_from: string;
          available_until: string;
          published: boolean;
          passing_score: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          lecturer_id: string;
          title: string;
          description?: string | null;
          duration_minutes: number;
          available_from: string;
          available_until: string;
          published?: boolean;
          passing_score?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['tests']['Insert']>;
      };
      questions: {
        Row: {
          id: string;
          test_id: string;
          type: QuestionType;
          prompt: string;
          options: QuestionOption[] | null;
          correct_answer: string | null;
          points: number;
          order_index: number;
        };
        Insert: {
          id?: string;
          test_id: string;
          type: QuestionType;
          prompt: string;
          options?: QuestionOption[] | null;
          correct_answer?: string | null;
          points?: number;
          order_index?: number;
        };
        Update: Partial<Database['public']['Tables']['questions']['Insert']>;
      };
      test_attempts: {
        Row: {
          id: string;
          test_id: string;
          student_id: string;
          started_at: string;
          expires_at: string;
          submitted_at: string | null;
          status: AttemptStatus;
          score: number | null;
          requires_manual_grading: boolean;
        };
        Insert: {
          id?: string;
          test_id: string;
          student_id: string;
          started_at?: string;
          expires_at: string;
          submitted_at?: string | null;
          status?: AttemptStatus;
          score?: number | null;
          requires_manual_grading?: boolean;
        };
        Update: Partial<Database['public']['Tables']['test_attempts']['Insert']>;
      };
      answers: {
        Row: {
          id: string;
          attempt_id: string;
          question_id: string;
          response: string | null;
          points_awarded: number | null;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          question_id: string;
          response?: string | null;
          points_awarded?: number | null;
        };
        Update: Partial<Database['public']['Tables']['answers']['Insert']>;
      };
      assignments: {
        Row: {
          id: string;
          course_id: string;
          title: string;
          description: string | null;
          due_date: string;
          max_points: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          description?: string | null;
          due_date: string;
          max_points?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['assignments']['Insert']>;
      };
      submissions: {
        Row: {
          id: string;
          course_id: string;
          student_id: string;
          assignment_id: string | null;
          assignment_title: string;
          file_path: string | null;
          content: string | null;
          submitted_at: string;
          grade: number | null;
          feedback: string | null;
          graded_by: string | null;
          graded_at: string | null;
        };
        Insert: {
          id?: string;
          course_id: string;
          student_id: string;
          assignment_id?: string | null;
          assignment_title: string;
          file_path?: string | null;
          content?: string | null;
          submitted_at?: string;
          grade?: number | null;
          feedback?: string | null;
          graded_by?: string | null;
          graded_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['submissions']['Insert']>;
      };
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          target_table: string;
          target_id: string;
          old_value: Json | null;
          new_value: Json | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          actor_id?: string | null;
          action: string;
          target_table: string;
          target_id: string;
          old_value?: Json | null;
          new_value?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>;
      };
      data_subject_requests: {
        Row: {
          id: string;
          request_type: DataRequestType;
          full_name: string;
          email: string;
          details: string;
          status: DataRequestStatus;
          received_at: string;
          due_at: string;
          resolved_at: string | null;
          handled_by: string | null;
        };
        Insert: {
          id?: string;
          request_type: DataRequestType;
          full_name: string;
          email: string;
          details: string;
          status?: DataRequestStatus;
          received_at?: string;
          due_at?: string;
          resolved_at?: string | null;
          handled_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['data_subject_requests']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      finalize_expired_attempts: {
        Args: Record<string, never>;
        Returns: void;
      };
      get_student_questions: {
        Args: { target_test_id: string };
        Returns: Array<{ id: string; test_id: string; type: QuestionType; prompt: string; options: QuestionOption[] | null; points: number; order_index: number }>;
      };
      start_test_attempt: {
        Args: { target_test_id: string };
        Returns: Array<{ attempt_id: string; expires_at: string; status: AttemptStatus; score: number | null; requires_manual_grading: boolean }>;
      };
      save_test_answers: {
        Args: { target_test_id: string; submitted_answers: Json };
        Returns: number;
      };
      submit_test_attempt: {
        Args: { target_test_id: string; submitted_answers?: Json };
        Returns: Array<{ attempt_id: string; status: AttemptStatus; score: number | null; requires_manual_grading: boolean }>;
      };
      submit_assignment: {
        Args: { target_assignment_id: string; response_content: string };
        Returns: string;
      };
      create_test_with_questions: {
        Args: { payload: Json };
        Returns: string;
      };
      admin_update_user: {
        Args: { target_user_id: string; new_role: UserRole; new_status: AccountStatus; reviewer_id: string };
        Returns: void;
      };
      publish_course_material: {
        Args: { target_course_id: string; material_title: string; material_description: string | null; material_kind: MaterialType; material_url: string | null; material_content: string | null; publish_now: boolean };
        Returns: string;
      };
      publish_global_announcement: {
        Args: { announcement_kind: 'public' | 'college'; announcement_title: string; announcement_body: string };
        Returns: string;
      };
    };
  };
}
