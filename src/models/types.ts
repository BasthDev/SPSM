/** Appwrite collection / bucket IDs */
export const DATABASE_ID = 'spsm_db';
export const COLLECTION_USERS = 'users';
export const COLLECTION_SUBMISSIONS = 'thesis_submissions';
export const COLLECTION_OPTIONS = 'submission_options';
export const COLLECTION_APPROVAL_LOGS = 'approval_logs';
export const COLLECTION_DEPARTMENTS = 'departments';
export const COLLECTION_BATCH_YEARS = 'batch_years';
export const COLLECTION_LECTURERS = 'lecturers';
export const BUCKET_JOURNALS = 'journal_files';

/** User roles */
export type UserRole = 'student' | 'lecturer' | 'reviewer' | 'kaprodi' | 'admin';

/** Submission statuses */
export type SubmissionStatus =
  | 'pending_lecturer'
  | 'waiting_kaprodi'
  | 'approved'
  | 'revision'
  | 'rejected';

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
  role: 'lecturer' | 'reviewer' | 'kaprodi' | 'admin';
  is_active: boolean;
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
  avatar_url?: string | null;
  created_at?: string;
}

/** Thesis submission header */
export interface ThesisSubmission {
  $id: string;
  student_id: string;
  advisor_id: string | null;
  status: SubmissionStatus;
  submitted_at: string;
  $createdAt?: string;
  $updatedAt?: string;
  // Hydrated details
  advisor?: LecturerItem | null;
  options?: SubmissionOption[];
  logs?: ApprovalLog[];
  selectedOption?: SubmissionOption | null;
  kaprodiApprovalDate?: string | null;
  kaprodiName?: string | null;
  kaprodiNotes?: string | null;
  reviewerNotes?: string | null;
}

/** Individual title option within a submission */
export interface SubmissionOption {
  $id: string;
  submission_id: string;
  option_number: number;
  title: string;
  background: string;
  journal_title: string;
  journal_author: string;
  journal_file_id: string | null;
  is_selected_by_lecturer: boolean;
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
  pdfFile?: any;
}

/** Onboarding form data */
export interface OnboardingFormData {
  name: string;
  email: string;
  nim: string;
  department: string;
  batchYear: string;
  whatsapp?: string;
  avatarUrl?: string | null;
}

/** Fallback Departments if offline or loading */
export const FALLBACK_DEPARTMENTS = [
  { label: 'Teknik Informatika (TI)', value: 'TI' },
  { label: 'Sistem Informasi (SI)', value: 'SI' },
  { label: 'Teknik Elektro (TE)', value: 'TE' },
  { label: 'Teknik Mesin (TM)', value: 'TM' },
  { label: 'Teknik Sipil (TS)', value: 'TS' },
  { label: 'Manajemen (MN)', value: 'MN' },
  { label: 'Akuntansi (AK)', value: 'AK' },
];

/** Fallback Batch Years if offline or loading */
export const FALLBACK_BATCH_YEARS = [
  { label: 'Angkatan 2024 (Letting 24)', value: '2024' },
  { label: 'Angkatan 2023 (Letting 23)', value: '2023' },
  { label: 'Angkatan 2022 (Letting 22)', value: '2022' },
  { label: 'Angkatan 2021 (Letting 21)', value: '2021' },
  { label: 'Angkatan 2020 (Letting 20)', value: '2020' },
  { label: 'Angkatan 2019 (Letting 19)', value: '2019' },
];
