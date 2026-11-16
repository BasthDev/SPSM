import type { ApprovalLog, LecturerItem, ThesisSubmission, UserProfile } from '@/models/types';

/**
 * Humanizer untuk Approval Log ("Catatan & Jejak Penilaian").
 * Semua tampilan harus ramah pengguna: tanpa ID mentah, tanpa JSON,
 * tanpa snake_case.
 */

const ACTION_LABELS: Record<string, string> = {
  PENGAJUAN_MAHASISWA: 'Pengajuan Mahasiswa',
  REVISI_PENGAJUAN: 'Revisi Pengajuan',
  VERIFIKASI_DOSEN_PENILAI: 'Verifikasi & Pemilihan Dosen Pembimbing',
  VERIFIKASI_DOSEN: 'Verifikasi Dosen Penilai',
  DISAHKAN_KAPRODI: 'Disahkan Kaprodi',
  PENGESAHAN_KAPRODI: 'Disahkan Kaprodi',
  APPROVAL_KAPRODI: 'Disahkan Kaprodi',
  MINTA_REVISI: 'Permintaan Revisi Judul',
  REVISI: 'Permintaan Revisi',
  DITOLAK: 'Ditolak',
  REJECTED: 'Ditolak',
  DOSEN_TOLAK_PENUGASAN: 'Dosen Menolak Penugasan',
  PROSES_TTD_DEKAN: 'Proses Tanda Tangan Dekan',
  PENOMORAN_SURAT: 'Penomoran Surat Keputusan',
  UPLOAD_SCAN_SK: 'Upload Scan SK',
  SK_TERBIT: 'SK Resmi Terbit',
  SK_RESMI_TERBIT: 'SK Resmi Terbit',
  UPLOAD_SKRSIPSI: 'Upload File Skripsi',
  STATUS_UPDATE: 'Pembaruan Status',
};

/** Label aksi yang sudah pasti manusiawi; fallback: underscore -> spasi + kapitalisasi. */
export function humanizeLogAction(action?: string | null): string {
  const key = (action || '').trim();
  if (!key) return 'Catatan';
  const mapped = ACTION_LABELS[key.toUpperCase()];
  if (mapped) return mapped;
  return key
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/** true bila string tampak seperti ID database (bukan nama manusia). */
export function isOpaqueId(value?: string | null): boolean {
  if (!value) return false;
  const v = String(value).trim();
  if (!v || v.includes(' ') || v.includes('@')) return false;
  // PocketBase/Appwrite id: 15–20 char alfanumerik; NIP/NIM numerik panjang
  return /^[a-z0-9]{12,24}$/i.test(v) || /^\d{8,20}$/.test(v);
}

function lecturerMatches(lec: LecturerItem | null | undefined, id?: string | null): boolean {
  if (!lec || !id) return false;
  const v = String(id);
  return lec.$id === v || lec.id === v || lec.user_id === v || lec.userId === v || lec.nip === v;
}

/** Cari nama dosen dari submission (pembimbing / preferensi) berdasarkan id atau NIP. */
function lecturerNameFor(id: string | null | undefined, sub?: ThesisSubmission | null): string | null {
  if (!id || !sub) return null;
  const candidates = [
    sub.advisor,
    sub.advisor2,
    sub.advisor1,
    sub.preferredAdvisor1,
    sub.preferredAdvisor2,
  ];
  const hit = candidates.find((c) => lecturerMatches(c, id));
  return hit?.name || null;
}

/** Nama tampilan actor log — actor_name dari server, fallback ke actor_id yang manusiawi. */
export function formatLogActorName(
  log: Pick<ApprovalLog, 'actor_id' | 'actor_name' | 'actorName'>,
  submission?: ThesisSubmission | null
): string {
  const serverName = (log as any).actor_name || (log as any).actorName;
  if (serverName && String(serverName).trim()) return String(serverName).trim();

  const actor = String(log.actor_id || '').trim();
  if (!actor || actor.toLowerCase() === 'system') return 'Sistem';
  if (!isOpaqueId(actor)) return actor;

  // Coba cocokkan dengan pihak yang terkait pengajuan ini
  if (submission) {
    if (submission.student_id === actor || (submission.student as UserProfile | undefined)?.user_id === actor) {
      return submission.student?.name || 'Mahasiswa';
    }
    const hit = [
      submission.advisor,
      submission.advisor2,
      submission.advisor1,
      submission.preferredAdvisor1,
      submission.preferredAdvisor2,
    ].find((c) => lecturerMatches(c, actor));
    if (hit?.name) return hit.name;
  }
  return 'Sistem';
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const KNOWN_TEXT_KEYS = ['text', 'message', 'note', 'notes', 'catatan', 'alasan', 'reason', 'keterangan'];
const SKIP_KEYS = new Set([
  'generated_at',
  'created_at',
  'updated_at',
  'file_id',
  'pref1',
  'pref2',
  'pref1_id',
  'pref2_id',
]);

/** Ubah payload JSON notes menjadi baris teks yang manusiawi (tanpa ID/JSON mentah). */
function formatJsonNotes(parsed: Record<string, any>, sub?: ThesisSubmission | null): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  const push = (s?: string | null) => {
    const v = String(s ?? '').trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      lines.push(v);
    }
  };

  for (const k of KNOWN_TEXT_KEYS) {
    const v = parsed[k];
    if (typeof v === 'string' && v.trim()) {
      push(k === 'alasan' || k === 'reason' ? `Alasan: ${v.trim()}` : v.trim());
    }
  }

  if (parsed.nomor_surat) push(`Nomor SK: ${parsed.nomor_surat}`);
  if (parsed.urutan !== undefined && parsed.urutan !== null && parsed.urutan !== '') {
    push(`Urutan SK: ke-${parsed.urutan}`);
  }

  // Preferensi dosen pembimbing mahasiswa
  const p1 = parsed.pref1_name || lecturerNameFor(parsed.pref1, sub);
  const p2 = parsed.pref2_name || lecturerNameFor(parsed.pref2, sub);
  if (p1 || p2 || parsed.pref1 || parsed.pref2) {
    push(
      `Usulan calon pembimbing — Prioritas 1: ${p1 || 'Tidak ditentukan'}; Prioritas 2: ${p2 || 'Tidak ditentukan'}.`
    );
  }

  // Berkas terlampir (SK scan / naskah skripsi)
  if (parsed.file_name) {
    const size = typeof parsed.size === 'number' ? formatBytes(parsed.size) : '';
    push(`Berkas: ${parsed.file_name}${size ? ` (${size})` : ''}`);
  }

  // Penetapan dosen pembimbing / opsi judul via ID
  const optId = parsed.selectedOptionId || parsed.optionId || parsed.selected_option_id;
  if (optId && sub?.options) {
    const opt = sub.options.find((o) => o.$id === optId || (o as any).id === optId);
    if (opt) push(`Judul terpilih: Opsi ${opt.option_number} — ${opt.title}`);
  }
  for (const [key, label] of [
    ['advisor1Id', 'Dosen Pembimbing 1'],
    ['advisor2Id', 'Dosen Pembimbing 2'],
    ['advisor_1_id', 'Dosen Pembimbing 1'],
    ['advisor_2_id', 'Dosen Pembimbing 2'],
  ] as const) {
    const v = parsed[key];
    if (v) {
      const name = lecturerNameFor(v, sub);
      if (name) push(`${label}: ${name}`);
    }
  }

  // Sisa key lain: tampilkan hanya nilai yang terlihat manusiawi
  for (const [k, v] of Object.entries(parsed)) {
    if (SKIP_KEYS.has(k) || KNOWN_TEXT_KEYS.includes(k)) continue;
    if (k.endsWith('_id') || k === 'id' || k.endsWith('Id') || k.endsWith('ID')) continue;
    if (typeof v === 'string' && v.trim() && !isOpaqueId(v)) {
      push(`${humanizeKey(k)}: ${v.trim()}`);
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      push(`${humanizeKey(k)}: ${v}`);
    }
  }

  return lines;
}

/**
 * Format notes log menjadi teks siap tampil.
 * JSON -> baris per-field yang manusiawi; teks biasa -> apa adanya.
 */
export function formatLogNotes(
  notes: string | null | undefined,
  action?: string | null,
  submission?: ThesisSubmission | null
): string {
  if (!notes) return '';
  const raw = String(notes).trim();
  if (!raw) return '';

  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const lines = formatJsonNotes(parsed, submission);
        if (lines.length > 0) return lines.join('\n');
        return '';
      }
      if (Array.isArray(parsed)) {
        return parsed
          .map((it) => (typeof it === 'string' ? it : it?.note || it?.feedback || it?.title || ''))
          .filter(Boolean)
          .join('\n');
      }
      return String(parsed);
    } catch {
      return raw;
    }
  }
  return raw;
}
