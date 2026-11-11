/** Appwrite collection / bucket IDs */
export const DATABASE_ID = 'spsm_db';
export const COLLECTION_SYSTEM_SETTINGS = 'system_settings';
export const COLLECTION_USERS = 'users';
export const COLLECTION_SUBMISSIONS = 'thesis_submissions';
export const COLLECTION_OPTIONS = 'submission_options';
export const COLLECTION_SURAT = 'surat';
export const COLLECTION_APPROVAL_LOGS = 'approval_logs';
export const COLLECTION_DEPARTMENTS = 'departments';
export const COLLECTION_BATCH_YEARS = 'batch_years';
export const COLLECTION_LECTURERS = 'lecturers';
export const BUCKET_JOURNALS = 'journal_files';
export const BUCKET_SK = 'journal_files'; // Same bucket configured to hold all files

/** User roles */
export type UserRole = 'student' | 'lecturer' | 'reviewer' | 'kaprodi' | 'akademik' | 'admin';

/** Submission statuses (Blueprint v2.2) */
export type SubmissionStatus =
  | 'drafting'
  | 'pending_lecturer'
  | 'waiting_kaprodi'
  | 'waiting_akademik'
  | 'sk_process'
  | 'sk_issued'
  | 'revision'
  | 'rejected'
  | 'approved'; // Backward compatibility

/** Department / Program Studi */
export interface DepartmentItem {
  $id: string;
  name: string;
  code: string;
  faculty?: string;
  is_active: boolean;
}

/** Batch Year / Letting */
export interface BatchYearItem {
  $id: string;
  year: number;
  label: string;
  is_active: boolean;
}

/** Lecturer / Dosen */
export interface LecturerItem {
  $id: string;
  user_id?: string;
  nip: string;
  name: string;
  email: string;
  department_id: string;
  expertise?: string;
  quota: number;
  current_students: number;
  role: 'lecturer' | 'reviewer' | 'kaprodi' | 'akademik' | 'admin';
  is_active: boolean;
}

/** Student Academic Requirements (Prasyarat Akademik) */
export interface AcademicRequirements {
  sks: number;
  completed_courses: string[];
  gpa?: number;
  passed_prerequisites?: boolean;
}

/** User profile stored in the `users` collection */
export interface UserProfile {
  $id: string;
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  nim_or_nip: string;
  department: string;
  batch_year: number;
  current_sks?: number;
  academic_requirements?: string; // JSON string of AcademicRequirements
  avatar_url?: string | null;
  has_uploaded_thesis?: boolean;
  created_at?: string;
}

/** Surat Management Model (Blueprint v2.2) */
export interface SuratItem {
  $id: string;
  submission_id: string;
  nomor_surat: string;
  urutan: number;
  no_dokumen: string;
  template_sk_id?: string | null;
  scanned_sk_id?: string | null;
  created_at: string;
}

/** Thesis submission header */
export interface ThesisSubmission {
  $id: string;
  student_id: string;
  advisor_id?: string | null;
  advisor_1_id?: string | null;
  advisor_2_id?: string | null;
  status: SubmissionStatus;
  submitted_at: string;
  $createdAt?: string;
  $updatedAt?: string;
  // Hydrated details
  student?: UserProfile | null;
  advisor?: LecturerItem | null; // Pembimbing 1 (Utama)
  advisor2?: LecturerItem | null; // Pembimbing 2 (Pendamping)
  preferredAdvisor1?: LecturerItem | null;
  preferredAdvisor2?: LecturerItem | null;
  options?: SubmissionOption[];
  logs?: ApprovalLog[];
  selectedOption?: SubmissionOption | null;
  kaprodiApprovalDate?: string | null;
  kaprodiName?: string | null;
  kaprodiNotes?: string | null;
  reviewerNotes?: string | null;
  surat?: SuratItem | null;
  nomor_surat?: string | null;
  urutan_surat?: string | null;
  sk_generated_at?: string | null;
}

/** Individual title option within a submission */
export interface SubmissionOption {
  $id: string;
  submission_id: string;
  option_number: number;
  title: string;
  background?: string;
  relevance_table?: string;
  relevance_variable?: string; // Variabel / Fokus Penelitian
  relevance_methodology?: string; // Metodologi Jurnal Acuan
  relevance_note?: string; // Kesesuaian / Relevansi dengan Topik Mahasiswa
  journal_title?: string;
  journal_author?: string;
  journal_year?: string;
  journal_file_id?: string | null;
  lecturer_notes?: string;
  revision_note?: string;
  is_selected?: boolean;
  is_selected_by_lecturer?: boolean;
}

/** Approval log entry */
export interface ApprovalLog {
  $id: string;
  submission_id: string;
  actor_id: string;
  action: string;
  notes: string | null;
  created_at: string;
}

/** Form data for creating a single title option */
export interface OptionFormData {
  number: number;
  title: string;
  background: string;
  journalTitle?: string;
  journalAuthor?: string;
  journalYear?: string;
  pdfFile?: any;
  // Relevance Table fields
  relevanceVariable?: string;
  relevanceMethodology?: string;
  relevanceNote?: string;
}

/** System Settings for submission period & validation (Blueprint v2.2) */
export interface SystemSettings {
  is_active: boolean;
  start_date: string;
  end_date: string;
  academic_year: string;
  min_sks: number;
  required_title_count: number;
  required_courses: string[];
}

/** Onboarding form data */
export interface OnboardingFormData {
  name: string;
  email: string;
  nim: string;
  department: string;
  batchYear: string;
  currentSks?: string;
  whatsapp?: string;
  avatarUrl?: string | null;
}

/** Fallback Departments if offline or loading */
export const FALLBACK_DEPARTMENTS = [
  { label: 'Teknik Informatika (TI)', value: 'TI' },
  { label: 'Sistem Informasi (SI)', value: 'SI' },
  { label: 'Bisnis Digital (BD)', value: 'BD' },
  { label: 'Teknik Elektro (TE)', value: 'TE' },
  { label: 'Teknik Mesin (TM)', value: 'TM' },
  { label: 'Teknik Sipil (TS)', value: 'TS' },
  { label: 'Manajemen (MN)', value: 'MN' },
  { label: 'Akuntansi (AK)', value: 'AK' },
];

/** Fallback Batch Years if offline or loading */
export const FALLBACK_BATCH_YEARS = [
  { label: 'Angkatan 2025', value: '2025' },
  { label: 'Angkatan 2024', value: '2024' },
  { label: 'Angkatan 2023', value: '2023' },
  { label: 'Angkatan 2022', value: '2022' },
  { label: 'Angkatan 2021', value: '2021' },
];
