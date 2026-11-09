export type UserRole = 'student' | 'lecturer' | 'reviewer' | 'kaprodi' | 'admin';

export type SubmissionStatus =
  | 'pending_lecturer'
  | 'waiting_kaprodi'
  | 'approved'
  | 'rejected'
  | 'revision';

export interface UserProfile {
  $id: string;
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  nim_or_nip: string;
  department: string;
  batch_year: string;
  avatar_url?: string;
  created_at?: string;
}

export interface Lecturer {
  $id: string;
  user_id?: string;
  nip: string;
  name: string;
  email: string;
  department_id: string;
  expertise: string;
  quota: number;
  current_students: number;
  role: 'lecturer' | 'reviewer' | 'kaprodi' | 'admin';
  is_active: boolean;
}

export interface Department {
  $id: string;
  name: string;
  code: string;
  faculty: string;
  is_active: boolean;
}

export interface BatchYear {
  $id: string;
  year: number;
  label: string;
  is_active: boolean;
}

export interface SubmissionOption {
  $id: string;
  submission_id: string;
  option_number: number;
  title: string;
  background: string;
  journal_title: string;
  journal_author: string;
  journal_file_id?: string;
  is_selected_by_lecturer: boolean;
}

export interface ThesisSubmission {
  $id: string;
  student_id: string;
  advisor_id?: string;
  status: SubmissionStatus;
  submitted_at: string;
  $createdAt?: string;
  $updatedAt?: string;
  // Hydrated fields
  student?: UserProfile;
  advisor?: Lecturer;
  options?: SubmissionOption[];
  logs?: ApprovalLog[];
}

export interface ApprovalLog {
  $id: string;
  submission_id: string;
  actor_id: string;
  action: string;
  notes?: string;
  created_at: string;
}
