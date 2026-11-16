export const STATUS_META: Record<string, { label: string; tone: 'blue' | 'green' | 'amber' | 'red' | 'slate' | 'violet' | 'cyan' }> = {
  drafting: { label: 'Draft', tone: 'slate' },
  pending_lecturer: { label: 'Menunggu Dosen', tone: 'blue' },
  waiting_kaprodi: { label: 'Menunggu Kaprodi', tone: 'violet' },
  waiting_akademik: { label: 'Menunggu Akademik', tone: 'cyan' },
  sk_process: { label: 'Proses SK', tone: 'amber' },
  sk_issued: { label: 'SK Terbit', tone: 'green' },
  approved: { label: 'Disetujui', tone: 'green' },
  rejected: { label: 'Ditolak', tone: 'red' },
  revision: { label: 'Revisi', tone: 'amber' },
};

export function statusMeta(status?: string) {
  return STATUS_META[status || ''] || { label: status || '-', tone: 'slate' as const };
}

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
