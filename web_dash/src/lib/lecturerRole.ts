import type { ThesisSubmission } from '@/types';

/**
 * Posisi dosen pada sebuah pengajuan:
 * - 'Pembimbing 1' / 'Pembimbing 2'  → sudah di-assign (advisor1/advisor2)
 * - 'Pilihan #1' / 'Pilihan #2'      → masih pilihan awal mahasiswa (preferred)
 */
export type LecturerPosition = 'advisor1' | 'advisor2' | 'pref1' | 'pref2';

export const LECTURER_POSITION_LABEL: Record<LecturerPosition, string> = {
  advisor1: 'Pembimbing 1',
  advisor2: 'Pembimbing 2',
  pref1: 'Pilihan Mahasiswa #1',
  pref2: 'Pilihan Mahasiswa #2',
};

function idsOf(...vals: unknown[]): string[] {
  return vals.filter(Boolean).map(String);
}

export function lecturerPositionOn(sub: ThesisSubmission, lecturerId?: string | null): LecturerPosition | null {
  if (!lecturerId) return null;
  const lid = String(lecturerId);
  const s = sub as any;

  const adv1 = idsOf(s.advisor?.$id, s.advisor1_id, s.advisor1Id, s.advisor1);
  const adv2 = idsOf(s.advisor2?.$id, s.advisor2_id, s.advisor2Id, s.advisor_2_id);
  const pref1 = idsOf(s.preferredAdvisor1?.$id, s.preferredAdvisor1Id, s.preferred_advisor1_id);
  const pref2 = idsOf(s.preferredAdvisor2?.$id, s.preferredAdvisor2Id, s.preferred_advisor2_id);

  if (adv1.includes(lid)) return 'advisor1';
  if (adv2.includes(lid)) return 'advisor2';
  if (pref1.includes(lid)) return 'pref1';
  if (pref2.includes(lid)) return 'pref2';
  return null;
}

/** Filter: pengajuan yang melibatkan dosen tsb (assign ATAU pilihan mahasiswa). */
export function submissionInvolvesLecturer(sub: ThesisSubmission, lecturerId?: string | null): boolean {
  return lecturerPositionOn(sub, lecturerId) !== null;
}
