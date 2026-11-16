/**
 * Mappers: backend DTOs (camelCase) -> bentuk Appwrite-like (snake_case, $id)
 * yang dipakai oleh views/components web yang sudah ada.
 */
import type {
  UserProfile,
  Lecturer,
  Department,
  BatchYear,
  SubmissionOption,
  ThesisSubmission,
  ApprovalLog,
} from '../types';

const doc = (d: any) => ({
  ...d,
  $id: d.$id || d.id,
  $createdAt: d.$createdAt || d.createdAt,
  $updatedAt: d.$updatedAt || d.updatedAt,
});

export const mapUserProfile = (d: any): UserProfile =>
  doc({
    ...d,
    user_id: d.user_id ?? d.userId,
    nim_or_nip: d.nim_or_nip ?? d.nimOrNip ?? d.nim,
    department: d.department ?? '',
    batch_year: d.batch_year ?? d.batchYear ?? '',
    avatar_url: d.avatar_url ?? d.avatarUrl,
    has_uploaded_thesis: d.has_uploaded_thesis ?? d.hasUploadedThesis ?? d.thesisUploaded,
    created_at: d.created_at ?? d.createdAt,
  });

export const mapLecturer = (d: any): Lecturer =>
  doc({
    ...d,
    user_id: d.user_id ?? d.userId,
    nip: d.nip ?? '',
    name: d.name ?? '',
    email: d.email ?? '',
    department_id: d.department_id ?? d.departmentId ?? d.department,
    expertise: d.expertise ?? '',
    quota: d.quota ?? d.maxAdviseeQuota ?? 0,
    current_students: d.current_students ?? d.currentStudents ?? d.currentAdviseeCount ?? 0,
    role: d.role ?? 'lecturer',
    is_active: d.is_active ?? d.isActive ?? true,
    rejected_assignments: d.rejected_assignments ?? d.rejectedAssignments ?? 0,
    rejection_history: d.rejection_history ?? d.rejectionHistory ?? [],
  });

export const mapDepartment = (d: any): Department =>
  doc({
    ...d,
    name: d.name ?? '',
    code: d.code ?? '',
    faculty: d.faculty ?? '',
    is_active: d.is_active ?? d.isActive ?? true,
  });

export const mapBatchYear = (d: any): BatchYear =>
  doc({
    ...d,
    year: Number(d.year ?? 0),
    label: d.label ?? String(d.year ?? ''),
    is_active: d.is_active ?? d.isActive ?? true,
  });

export const mapSubmissionOption = (d: any): SubmissionOption =>
  doc({
    ...d,
    submission_id: d.submission_id ?? d.submissionId,
    option_number: d.option_number ?? d.optionNumber,
    title: d.title ?? '',
    background: d.background ?? '',
    journal_title: d.journal_title ?? d.journalTitle,
    journal_author: d.journal_author ?? d.journalAuthor,
    journal_year: d.journal_year ?? d.journalYear,
    journal_file_id: d.journal_file_id ?? d.journalFileId,
    is_selected_by_lecturer:
      d.is_selected_by_lecturer ?? d.isSelectedByLecturer ?? d.isSelected ?? false,
    relevance_variable: d.relevance_variable ?? d.relevanceVariable,
    relevance_methodology: d.relevance_methodology ?? d.relevanceMethodology,
    relevance_note: d.relevance_note ?? d.relevanceNote,
    revision_note: d.revision_note ?? d.revisionNote,
  });

export const mapApprovalLog = (d: any): ApprovalLog =>
  doc({
    ...d,
    submission_id: d.submission_id ?? d.submissionId,
    actor_id: d.actor_id ?? d.actorId,
    actor_name: d.actor_name ?? d.actorName,
    action: d.action ?? '',
    notes: d.notes,
    created_at: d.created_at ?? d.createdAt,
  });

export const mapSubmission = (d: any): ThesisSubmission => {
  const advIds = [d.advisor1Id ?? d.advisor1_id, d.advisor2Id ?? d.advisor2_id]
    .filter(Boolean)
    .join(',');
  return doc({
    ...d,
    student_id: d.student_id ?? d.studentId,
    advisor_id: advIds || d.advisor_id,
    advisor1_id: d.advisor1_id ?? d.advisor1Id,
    advisor2_id: d.advisor2_id ?? d.advisor2Id,
    // 'sk_issued' adalah status kanonik backend untuk "approved" versi web.
    status: d.status === 'sk_issued' ? 'approved' : d.status,
    submitted_at: d.submitted_at ?? d.submittedAt,
    reviewer_notes: d.reviewer_notes ?? d.reviewerNotes,
    kaprodi_notes: d.kaprodi_notes ?? d.kaprodiNotes,
    nomor_surat: d.nomor_surat ?? d.surat?.nomorSurat ?? null,
    urutan_surat: d.urutan_surat ?? (d.surat?.urutan != null ? String(d.surat.urutan) : null),
    sk_generated_at: d.sk_generated_at ?? d.surat?.createdAt ?? null,
    student: d.student ? mapUserProfile(d.student) : undefined,
    advisor: d.advisor ?? (d.advisor1 ? mapLecturer(d.advisor1) : undefined),
    advisor2: d.advisor2 ? mapLecturer(d.advisor2) : undefined,
    preferredAdvisor1: d.preferredAdvisor1 ? mapLecturer(d.preferredAdvisor1) : undefined,
    preferredAdvisor2: d.preferredAdvisor2 ? mapLecturer(d.preferredAdvisor2) : undefined,
    options: Array.isArray(d.options) ? d.options.map(mapSubmissionOption) : undefined,
    logs: Array.isArray(d.logs) ? d.logs.map(mapApprovalLog) : undefined,
    surat: d.surat
      ? doc({
          ...d.surat,
          submission_id: d.surat.submission_id ?? d.surat.submissionId,
          nomor_surat: d.surat.nomor_surat ?? d.surat.nomorSurat,
          urutan_surat: d.surat.urutan_surat ?? d.surat.urutan,
        })
      : undefined,
  });
};

/** SystemSettings backend (camelCase) -> bentuk settingsService web (snake_case). */
export const mapSettings = (d: any) => ({
  is_active: Boolean(d.is_active ?? d.isActive ?? d.submissionOpen ?? true),
  start_date: d.start_date ?? d.startDate ?? '',
  end_date: d.end_date ?? d.endDate ?? '',
  academic_year: d.academic_year ?? d.academicYear ?? '',
  min_sks: typeof d.min_sks === 'number' ? d.min_sks : d.minSks,
  required_title_count:
    typeof d.required_title_count === 'number' ? d.required_title_count : d.requiredTitleCount,
  required_courses: Array.isArray(d.required_courses) ? d.required_courses : d.requiredCourses,
});

export function formatDateShort(iso?: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
