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
  | 'approved'; // Backward compatibility (≈ sk_issued)

/** Legacy status aliases normalized server-side */
export type LegacySubmissionStatus = 'approved_lecturer' | 'pending_kaprodi';

/** Statuses that block a student from submitting a new proposal */
export const ACTIVE_SUBMISSION_STATUSES: string[] = [
  'pending_lecturer',
  'waiting_kaprodi',
  'waiting_akademik',
  'sk_process',
  'sk_issued',
  'approved',
];

export function isActiveSubmissionStatus(status?: string | null): boolean {
  return !!status && ACTIVE_SUBMISSION_STATUSES.includes(status);
}

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

/** Lecturer / Dosen (LecturerDto from API) */
export interface LecturerItem {
  $id: string;
  id?: string;
  user_id?: string;
  userId?: string;
  nip: string;
  name: string;
  email: string;
  phone?: string;
  department?: string;
  department_id?: string;
  departmentId?: string;
  expertise?: string;
  quota?: number;
  current_students?: number;
  currentStudents?: number;
  role?: UserRole;
  is_active?: boolean;
  isActive?: boolean;
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
  nim?: string;
  department: string;
  batch_year: number;
  current_sks?: number;
  academic_requirements?: string; // JSON string of AcademicRequirements
  avatar_url?: string | null;
  phone?: string;
  has_uploaded_thesis?: boolean;
  created_at?: string;
}

/** Surat Management Model */
export interface SuratItem {
  $id: string;
  submission_id?: string;
  nomor_surat: string;
  nomorSurat?: string;
  urutan: number | string;
  no_dokumen?: string;
  noDokumen?: string;
  template_sk_id?: string | null;
  templateSkId?: string | null;
  scanned_sk_id?: string | null;
  scannedSkId?: string | null;
  created_at?: string;
  createdAt?: string;
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
  advisor1?: LecturerItem | null; // alias of advisor
  preferredAdvisor1?: LecturerItem | null;
  preferredAdvisor2?: LecturerItem | null;
  preferred_advisor_1_id?: string | null;
  preferred_advisor_2_id?: string | null;
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
  actor_name?: string | null;
  actorName?: string | null;
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
  phone?: string;
  currentSks?: string;
  avatarUrl?: string | null;
}

/** Fallback Departments (prodi UNMUHA) if offline or loading */
export const FALLBACK_DEPARTMENTS = [
  { label: 'Ilmu Hukum (IH)', value: 'IH' },
  { label: 'Akuntansi (AKT)', value: 'AKT' },
  { label: 'Manajemen (MNJ)', value: 'MNJ' },
  { label: 'Bisnis Digital (BD)', value: 'BD' },
  { label: 'Kewirausahaan (KWU)', value: 'KWU' },
  { label: 'Agribisnis (AGB)', value: 'AGB' },
  { label: 'Arsitektur (ARS)', value: 'ARS' },
  { label: 'Teknik Sipil (TSI)', value: 'TSI' },
  { label: 'Manajemen Bencana (MBN)', value: 'MBN' },
  { label: 'Pendidikan Agama Islam (PAI)', value: 'PAI' },
  { label: 'Tadris Bahasa Inggris (TBI)', value: 'TBI' },
  { label: 'Tadris Biologi (TBO)', value: 'TBO' },
  { label: 'Tadris Matematika (TMK)', value: 'TMK' },
  { label: 'Perbankan Syariah (PBS)', value: 'PBS' },
  { label: 'Ilmu Kesehatan Masyarakat (IKM)', value: 'IKM' },
  { label: 'Psikologi (PSI)', value: 'PSI' },
  { label: 'Perhotelan (PHO)', value: 'PHO' },
  { label: 'Fisioterapi (FIS)', value: 'FIS' },
];

/** Fallback Batch Years if offline or loading */
export const FALLBACK_BATCH_YEARS = [
  { label: 'Angkatan 2025', value: '2025' },
  { label: 'Angkatan 2024', value: '2024' },
  { label: 'Angkatan 2023', value: '2023' },
  { label: 'Angkatan 2022', value: '2022' },
  { label: 'Angkatan 2021', value: '2021' },
];
