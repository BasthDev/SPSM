export type UserRole = 'student' | 'lecturer' | 'reviewer' | 'kaprodi' | 'akademik' | 'admin';

export type SubmissionStatus =
  | 'drafting'
  | 'pending_lecturer'
  | 'waiting_kaprodi'
  | 'waiting_akademik'
  | 'sk_process'
  | 'sk_issued'
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
  has_uploaded_thesis?: boolean;
  created_at?: string;
}

export interface Lecturer {
  $id: string;
  user_id?: string;
  nip: string;
  name: string;
  email: string;
  department_id: string;
  department?: string;
  phone?: string;
  expertise: string;
  quota: number;
  current_students: number;
  role: 'lecturer' | 'reviewer' | 'kaprodi' | 'akademik' | 'admin';
  is_active: boolean;
  rejected_assignments?: number;
  rejection_history?: Array<{
    submissionId: string;
    slot: 'advisor1' | 'advisor2' | 'both';
    reason?: string;
    at: string;
  }>;
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
  journal_year?: string;
  journal_file_id?: string;
  is_selected_by_lecturer: boolean;
  // Relevance Table fields (dedicated columns; legacy docs may embed in background)
  relevance_variable?: string;
  relevance_methodology?: string;
  relevance_note?: string;
  // Title-specific revision/rejection notes from Reviewer
  revision_note?: string;
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
  advisor?: Lecturer; // Pembimbing 1 (Utama)
  advisor2?: Lecturer; // Pembimbing 2 (Pendamping)
  preferredAdvisor1?: Lecturer; // Pilihan awal mahasiswa #1
  preferredAdvisor2?: Lecturer; // Pilihan awal mahasiswa #2
  options?: SubmissionOption[];
  logs?: ApprovalLog[];
  nomor_surat?: string | null;
  urutan_surat?: string | null;
  sk_generated_at?: string | null;
}

export interface SystemSettings {
  is_active: boolean;
  start_date: string;
  end_date: string;
  academic_year: string;
}

export interface ApprovalLog {
  $id: string;
  submission_id: string;
  actor_id: string;
  actor_name?: string | null;
  action: string;
  notes?: string;
  created_at: string;
}
