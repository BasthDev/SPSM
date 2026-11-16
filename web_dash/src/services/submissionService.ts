import { apiClient } from './apiClient';
import { mapSubmission, mapSubmissionOption } from '../lib/mappers';
import { lecturerService } from './lecturerService';
import type {
  ThesisSubmission,
  SubmissionOption,
  SubmissionStatus,
} from '../types';

/**
 * Helper to extract 2-letter prodi code for Nomor Surat
 */
export function extractProdiCode(dept?: string): string {
  if (!dept) return 'TI';
  const clean = dept.trim().toUpperCase();
  if (clean.includes('BISNIS DIGITAL') || clean.startsWith('BD')) return 'BD';
  if (clean.includes('INFORMATIKA') || clean.startsWith('TI')) return 'TI';
  if (clean.includes('SISTEM INFORMASI') || clean.startsWith('SI')) return 'SI';
  if (clean.includes('ELEKTRO') || clean.startsWith('TE')) return 'TE';
  if (clean.includes('MESIN') || clean.startsWith('TM')) return 'TM';
  if (clean.includes('SIPIL') || clean.startsWith('TS')) return 'TS';
  if (clean.includes('MANAJEMEN') || clean.startsWith('MN')) return 'MN';
  if (clean.includes('AKUNTANSI') || clean.startsWith('AK')) return 'AK';
  if (clean.length <= 4) return clean;
  return clean.split(' ').map((w) => w[0]).join('').slice(0, 4) || 'TI';
}

/**
 * Helper to extract 2-digit angkatan for Nomor Surat
 */
export function extractAngkatan(batchYear?: number | string): string {
  if (!batchYear) return '23';
  const str = String(batchYear).trim();
  return str.length >= 2 ? str.slice(-2) : str.padStart(2, '0');
}

/**
 * Helper to format official Nomor Surat: URUTAN/SPSM/PRODI/ANGKATAN/TAHUN
 * Contoh: 01/SPSM/BD/23/2026
 */
export function formatNomorSurat(
  urutanNum: number,
  prodiCode: string,
  angkatan: string,
  year: number = new Date().getFullYear()
): { nomor_surat: string; urutan: string } {
  const urutan = String(urutanNum).padStart(2, '0');
  const nomor_surat = `${urutan}/SPSM/${prodiCode}/${angkatan}/${year}`;
  return { nomor_surat, urutan };
}

/**
 * Resolve relevance fields: prefer dedicated columns, fall back to
 * legacy `<!-- RELEVANCE_DATA -->` tag embedded in background text.
 */
function parseOptionRelevance(opt: SubmissionOption): SubmissionOption {
  if (opt.background && opt.background.includes('<!-- RELEVANCE_DATA:')) {
    const match = opt.background.match(/<!-- RELEVANCE_DATA:\s*(\{[\s\S]*?\})\s*-->/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        opt.relevance_variable = opt.relevance_variable || parsed.v || '';
        opt.relevance_methodology = opt.relevance_methodology || parsed.m || '';
        opt.relevance_note = opt.relevance_note || parsed.r || '';
        opt.background = opt.background.replace(/<!-- RELEVANCE_DATA:[\s\S]*?-->/g, '').trim();
      } catch {
        // ignore
      }
    }
  }
  return opt;
}

/**
 * Post-processing client-side pada submission yang sudah di-hydrate backend:
 * relevance table, nomor surat dari log DISAHKAN_KAPRODI, revision notes.
 */
function enrichSubmission(sub: ThesisSubmission, allApproved: ThesisSubmission[]): ThesisSubmission {
  if (sub.options) {
    sub.options = sub.options.map(parseOptionRelevance);
  }

  // Nomor surat dari log kaprodi (format JSON lama) — fallback bila surat
  // belum ter-hydrate.
  const kaprodiLog = sub.logs?.find(
    (l) => l.action === 'DISAHKAN_KAPRODI' || l.action?.toUpperCase().includes('KAPRODI')
  );
  if (kaprodiLog?.notes?.startsWith('{')) {
    try {
      const parsed = JSON.parse(kaprodiLog.notes);
      sub.nomor_surat = sub.nomor_surat || parsed.nomor_surat || null;
      sub.urutan_surat = sub.urutan_surat || parsed.urutan || null;
      sub.sk_generated_at = sub.sk_generated_at || parsed.generated_at || kaprodiLog.created_at;
      if (parsed.text) {
        kaprodiLog.notes = parsed.text;
      }
    } catch {
      // ignore
    }
  }

  // Fallback untuk approved lama tanpa nomor surat
  if (sub.status === 'approved' && !sub.nomor_surat) {
    const year = sub.$createdAt ? new Date(sub.$createdAt).getFullYear() : new Date().getFullYear();
    const prodi = extractProdiCode(sub.student?.department);
    const angkatan = extractAngkatan(sub.student?.batch_year);
    const idx = allApproved.indexOf(sub);
    const seq = idx >= 0 ? allApproved.length - idx : 1;
    const { nomor_surat, urutan } = formatNomorSurat(seq, prodi, angkatan, year);
    sub.nomor_surat = nomor_surat;
    sub.urutan_surat = urutan;
    sub.sk_generated_at = sub.$createdAt || new Date().toISOString();
  }

  // Hydrate per-option revision/rejection notes
  const decisionLog = sub.logs?.find(
    (l) => l.action === 'MINTA_REVISI' || l.action === 'DITOLAK'
  );
  if (decisionLog?.notes && sub.options) {
    sub.options.forEach((opt) => {
      const regex = new RegExp(`Judul\\s*#?${opt.option_number}\\s*:\\s*([^\\n]+)`, 'i');
      const m = decisionLog.notes!.match(regex);
      if (m && m[1]) {
        opt.revision_note = m[1].trim();
      }
    });
  }

  return sub;
}

async function unmarkAllOptions(submissionId: string): Promise<void> {
  try {
    const options = await apiClient.submissions.getOptions(submissionId);
    for (const opt of options || []) {
      const mapped = mapSubmissionOption(opt);
      if (mapped.is_selected_by_lecturer) {
        await apiClient.submissions.updateOption(mapped.$id, { isSelectedByLecturer: false });
      }
    }
  } catch {
    // ignore
  }
}

async function syncAdvisorsQuota(advisorId?: string) {
  if (!advisorId) return;
  const parts = advisorId.split(',').map((s) => s.trim()).filter(Boolean);
  for (const adv of parts) {
    await lecturerService.syncStudentCount(adv);
  }
}

export const submissionService = {
  async getAllSubmissions(
    statusFilter?: SubmissionStatus,
    advisorIdFilter?: string
  ): Promise<ThesisSubmission[]> {
    try {
      const filter: any = {};
      if (statusFilter) filter.status = statusFilter;
      if (advisorIdFilter && advisorIdFilter !== 'all') filter.advisorId = advisorIdFilter;

      const list = await apiClient.submissions.list(filter);
      const submissions = (list || []).map(mapSubmission);

      const approved = submissions.filter((s) => s.status === 'approved');
      return submissions.map((s) => enrichSubmission(s, approved));
    } catch (err) {
      console.error('Failed to get submissions:', err);
      return [];
    }
  },

  /**
   * Reviewer selects best title option and assigns BOTH Dosen Pembimbing 1 and Pembimbing 2.
   */
  async reviewAndSelectTitle(
    submissionId: string,
    selectedOptionId: string,
    advisor1Id: string,
    advisor2Id: string,
    reviewerName: string,
    notes: string
  ): Promise<void> {
    // 1. Tandai opsi terpilih, batalkan yang lain
    const options = await apiClient.submissions.getOptions(submissionId);
    for (const opt of options || []) {
      const isSelected = (opt.$id || opt.id) === selectedOptionId;
      await apiClient.submissions.updateOption(opt.$id || opt.id, {
        isSelected,
        isSelectedByLecturer: isSelected,
      });
    }

    // 2. Update status + kedua pembimbing
    await apiClient.submissions.update(submissionId, {
      advisor1Id: advisor1Id.trim() || null,
      advisor2Id: advisor2Id.trim() || null,
      status: 'waiting_kaprodi',
    });

    // 3. Approval log
    await apiClient.submissions.createLog(submissionId, {
      actorId: reviewerName,
      action: 'VERIFIKASI_DOSEN_PENILAI',
      notes: notes || 'Judul skripsi terpilih serta Dosen Pembimbing 1 & 2 telah ditetapkan.',
    });
  },

  /**
   * Kaprodi gives final endorsement (Approval).
   * Kaprodi can also modify Pembimbing 1 or 2 before approving.
   */
  async kaprodiApprove(
    submissionId: string,
    advisor1Id: string,
    advisor2Id: string,
    kaprodiName: string,
    notes: string
  ): Promise<void> {
    // 1. Ambil data submission untuk department/batchYear mahasiswa
    let department: string | undefined;
    let batchYear: string | number | undefined;
    try {
      const sub = await apiClient.submissions.getById(submissionId);
      department = sub?.student?.department;
      batchYear = sub?.student?.batchYear ?? sub?.student?.batch_year;
    } catch {
      // fallback
    }

    // 2. Generate surat + nomor surat DULU (sama seperti web_app lama) —
    //    jangan pakai status 'approved' karena backend menormalkannya
    //    langsung ke 'sk_issued' dan melewati antrian akademik.
    let surat: any = null;
    try {
      surat = await apiClient.surat.generate(submissionId, department, batchYear);
    } catch (err) {
      console.warn('generateSurat warning:', err);
    }

    // 3. Update status -> 'waiting_akademik' + kedua pembimbing + log
    //    (nomor surat ikut dicatat di notes JSON seperti flow lama).
    await apiClient.submissions.updateStatus(
      submissionId,
      'waiting_akademik',
      'DISAHKAN_KAPRODI',
      JSON.stringify({
        nomor_surat: surat?.nomorSurat || surat?.nomor_surat || null,
        urutan: surat?.urutan ?? null,
        text: notes || 'Judul dan Dosen Pembimbing resmi disahkan oleh Kaprodi. Menunggu administrasi SK.',
        generated_at: new Date().toISOString(),
      }),
      {
        advisor1Id: advisor1Id.trim() || null,
        advisor2Id: advisor2Id.trim() || null,
        kaprodiNotes: notes || null,
      }
    );

    // 4. Sync quota kedua pembimbing
    const combined = [advisor1Id, advisor2Id].filter(Boolean).join(',');
    await syncAdvisorsQuota(combined);
  },

  /**
   * Reject submission with structured notes for each of the 3 title options.
   * All 3 options are automatically unmarked/rejected.
   */
  async rejectSubmission(
    submissionId: string,
    actorName: string,
    noteOpt1: string,
    noteOpt2: string,
    noteOpt3: string,
    generalNotes?: string,
    advisorId?: string
  ): Promise<void> {
    const structuredNotes = `Catatan Penolakan per Judul:\nJudul 1: ${noteOpt1 || 'Tidak memenuhi kualifikasi penelitian.'}\nJudul 2: ${noteOpt2 || 'Tidak memenuhi kualifikasi penelitian.'}\nJudul 3: ${noteOpt3 || 'Tidak memenuhi kualifikasi penelitian.'}${generalNotes ? `\n\nCatatan Tambahan: ${generalNotes}` : ''}`;

    // Backend otomatis unmark options saat status rejected.
    await apiClient.submissions.updateStatus(submissionId, 'rejected', 'DITOLAK', structuredNotes);
    await syncAdvisorsQuota(advisorId);
  },

  /**
   * Request revision with structured notes for each of the 3 title options.
   * All 3 options are marked for revision.
   */
  async requestRevision(
    submissionId: string,
    actorName: string,
    noteOpt1: string,
    noteOpt2: string,
    noteOpt3: string,
    generalNotes?: string,
    advisorId?: string
  ): Promise<void> {
    const structuredNotes = `Catatan Revisi per Judul:\nJudul 1: ${noteOpt1 || 'Perlu perbaikan rumusan masalah.'}\nJudul 2: ${noteOpt2 || 'Perlu perbaikan rumusan masalah.'}\nJudul 3: ${noteOpt3 || 'Perlu perbaikan rumusan masalah.'}${generalNotes ? `\n\nCatatan Tambahan: ${generalNotes}` : ''}`;

    await apiClient.submissions.updateStatus(submissionId, 'revision', 'MINTA_REVISI', structuredNotes);
    await syncAdvisorsQuota(advisorId);
  },

  /**
   * Aggregates total verified submissions (waiting_kaprodi + approved),
   * excluding rejected and revision.
   */
  calculateTotalVerified(submissions: ThesisSubmission[]): number {
    return submissions.filter(
      (s) => s.status === 'waiting_kaprodi' || s.status === 'approved'
    ).length;
  },

  getFileViewUrl(fileId: string): string {
    if (!fileId) return '#';
    return apiClient.files.getViewUrl('journals', fileId);
  },
};
