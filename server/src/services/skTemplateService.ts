import JSZip from 'jszip';
import { storageAdapter, StorageBucket } from '../storage';
import { db } from '../database';
import { submissionService } from './submissionService';

/**
 * SK Template Service
 * -------------------
 * Template SK disimpan di collection `sk_files` (bucket 'sk') dengan
 * field `kind = 'template'`. Placeholder format: {{KEY}} (case-insensitive,
 * underscore/spasi equivalen). Saat user download SK, backend mengambil
 * template terbaru, mengisi placeholder dengan payload submission, lalu
 * menyimpan hasilnya sebagai file baru (kind='generated') dan mengembalikan
 * URL publik file tsb.
 *
 * Placeholder yang didukung (contoh):
 *   {{NAMA_MAHASISWA}} {{NIM}} {{PRODI}} {{ANGKATAN}} {{TAHUN_AJARAN}}
 *   {{JUDUL_SK}} {{NOMOR_SURAT}} {{TANGGL}} {{TANGGAL_PENGESAHAN}}
 *   {{DOSEN_PEMBIMBING_1}} {{NIP_1}} {{DOSEN_PEMBIMBING_2}} {{NIP_2}}
 *   {{KAPRODI}} {{KETUA_PRODI}} {{UNIVERSITAS}} {{NO_DOKUMEN}}
 */

interface SkPayload {
  [key: string]: string;
}

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const UNIVERSITAS = 'UNIVERSITAS MUHAMMADIYAH ACEH';

function formatTanggalId(date?: string | Date | null): string {
  if (!date) return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildPayload(sub: any): SkPayload {
  const student = sub.student || {};
  const surat = sub.surat || {};
  const adv1 = sub.advisor1 || sub.advisor || {};
  const adv2 = sub.advisor2 || {};
  const selectedOption = (sub.options || []).find((o: any) => o.isSelectedByLecturer || o.isSelectedByLecturer === true || o.is_selected_by_lecturer);
  const judul = selectedOption?.title || (sub.options?.[0]?.title) || '-';

  const prodi = student.department || '';
  const batchYear = student.batchYear ?? student.batch_year ?? '';
  const tahunAjaran = typeof batchYear === 'number' || /^\d{4}/.test(String(batchYear))
    ? `${batchYear}/${Number(batchYear) + 1}`
    : String(batchYear);

  const put = (map: SkPayload, aliases: string[], value: string | number | null | undefined) => {
    const v = value === null || value === undefined ? '' : String(value);
    for (const a of aliases) map[norm(a)] = v;
  };

  const p: SkPayload = {};
  put(p, ['NAMA_MAHASISWA', 'MAHASISWA_NAMA', 'NAMA'],
    student.name || (student.email ? student.email.split('@')[0] : ''));
  put(p, ['NIM', 'NIM_MAHASISWA', 'NIM_NOR_NIP'], student.nimOrNip || student.nim);
  put(p, ['EMAIL'], student.email);
  put(p, ['PRODI', 'PROGRAM_STUDI', 'JURUSAN', 'DEPARTEMEN'], prodi);
  put(p, ['FAKULTAS'], student.faculty || 'Fakultas');
  put(p, ['ANGKATAN', 'BATCH_YEAR', 'TAHUN_MASUK'], batchYear);
  put(p, ['TAHUN_AJARAN', 'TAHUN_LECTURE'], tahunAjaran);
  put(p, ['JUDUL_SK', 'JUDUL', 'JUDUL_SKRIPSI', 'JUDUL_YANG_DISAHKAN'], judul);
  put(p, ['NOMOR_SURAT', 'NO_SURAT', 'NOMOR'], surat.nomorSurat);
  put(p, ['URUTAN', 'URUTAN_SURAT'], surat.urutan != null ? String(surat.urutan) : undefined);
  put(p, ['NO_DOKUMEN', 'NOMOR_DOKUMEN'], surat.noDokumen);
  put(p, ['TANGGAL', 'TANGGAL_SK', 'TANGGAL_PENGESAHAN', 'TANGGAL_KEPUTUSAN'], formatTanggalId(surat.tanggalTerbit || surat.createdAt));
  put(p, ['TANGGAL_PENGAJUAN'], formatTanggalId(sub.submittedAt));
  put(p, ['DOSEN_PEMBIMBING_1', 'PEMBIMBING_1', 'DOSEN_PEMBIMBING_UTAMA', 'NAMA_DOSEN_1'], adv1.name);
  put(p, ['NIP_1', 'NIP_NIDN_1', 'NIP_DOSEN_1'], adv1.nip);
  put(p, ['DOSEN_PEMBIMBING_2', 'PEMBIMBING_2', 'PEMBIMBING_PENDAMPING', 'NAMA_DOSEN_2'], adv2.name);
  put(p, ['NIP_2', 'NIP_NIDN_2', 'NIP_DOSEN_2'], adv2.nip);
  put(p, ['KAPRODI', 'KETUA_PRODI', 'KAPALA_PRODI', 'NAMA_KAPRODI'], sub.kaprodiName || 'Ketua Program Studi');
  put(p, ['UNIVERSITAS', 'NAMA_UNIVERSITAS'], UNIVERSITAS);
  put(p, ['TAHUN'], new Date().getFullYear());
  return p;
}

function fillPlaceholders(text: string, payload: SkPayload): string {
  return text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_m, key) => {
    const k = norm(key);
    return k in payload ? payload[k] : `{{${key}}}`;
  });
}

async function fillDocx(buffer: Buffer, payload: SkPayload): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const xmlFiles = Object.keys(zip.files).filter(
    (n) => n.startsWith('word/') && n.endsWith('.xml')
  );
  for (const name of xmlFiles) {
    const file = zip.file(name);
    if (!file) continue;
    const content = await file.async('string');
    const filled = fillPlaceholders(content, payload);
    if (filled !== content) zip.file(name, filled);
  }
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}

async function fillText(buffer: Buffer, payload: SkPayload): Promise<Buffer> {
  return Buffer.from(fillPlaceholders(buffer.toString('utf8'), payload), 'utf8');
}

function extForMime(mime: string, fileName: string): string {
  const fromName = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
  if (fromName) return fromName;
  if (mime.includes('wordprocessingml') || mime.includes('msword')) return '.docx';
  if (mime.includes('html')) return '.html';
  if (mime.includes('pdf')) return '.pdf';
  return '.txt';
}

export class SkTemplateService {
  /** Ambil record template terbaru dari sk_files (kind='template'). */
  private async findTemplate(): Promise<any | null> {
    const files = await storageAdapter.listFiles('sk');
    const templates = files.filter((f: any) => (f as any).kind === 'template');
    if (!templates.length) return null;
    templates.sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return (storageAdapter as any).getRecord
      ? await (storageAdapter as any).getRecord('sk', templates[0].fileId || templates[0].id)
      : null;
  }

  /** Cari file generated untuk submission tertentu (nama: SK_<subId>__...). */
  private async findGenerated(submissionId: string): Promise<any | null> {
    const files = await storageAdapter.listFiles('sk');
    const prefix = `sk_${submissionId}__`.toLowerCase();
    const match = files.find((f: any) => (f.name || '').toLowerCase().startsWith(prefix));
    if (!match) return null;
    return (storageAdapter as any).getRecord
      ? await (storageAdapter as any).getRecord('sk', match.fileId || match.id)
      : null;
  }

  private recordFileUrl(record: any): string | null {
    const f = Array.isArray(record?.file) ? record.file[0] : record?.file;
    if (!f || !record?.id) return null;
    const base = (process.env.POCKETBASE_URL || 'https://spsm.basthstudio.my.id').replace(/\/$/, '');
    return `${base}/api/files/sk_files/${record.id}/${encodeURIComponent(f)}`;
  }

  /** Info template yang tersedia (untuk admin/UI). */
  async getTemplateInfo(): Promise<{ name: string; url: string | null } | null> {
    const record = await this.findTemplate();
    if (!record) return null;
    return {
      name: record.original_name || record.name || 'template',
      url: this.recordFileUrl(record),
    };
  }

  /**
   * Generate (atau ambil ulang) file SK terisi untuk sebuah submission.
   * Return { url, name, reused }.
   */
  async generateSkFile(submissionId: string): Promise<{ url: string; name: string; reused: boolean }> {
    // 1. Sudah ada file generated? pakai ulang.
    const existing = await this.findGenerated(submissionId);
    if (existing) {
      const url = this.recordFileUrl(existing);
      if (url) {
        return {
          url,
          name: existing.original_name || existing.name || 'SK.docx',
          reused: true,
        };
      }
    }

    // 2. Ambil template
    const template = await this.findTemplate();
    if (!template) {
      throw new Error('Template SK belum diupload. Upload file template (kind=template) ke bucket sk terlebih dahulu.');
    }
    const templateUrl = this.recordFileUrl(template);
    if (!templateUrl) throw new Error('Template SK tidak memiliki file.');

    const tplRes = await fetch(templateUrl);
    if (!tplRes.ok) throw new Error(`Gagal mengunduh template SK (${tplRes.status}).`);
    const tplBuffer = Buffer.from(await tplRes.arrayBuffer());
    const tplName = template.original_name || template.name || 'template.docx';
    const tplMime = template.mime || 'application/octet-stream';

    // 3. Payload submission
    const sub = await submissionService.getSubmissionById(submissionId);
    if (!sub) throw new Error('Pengajuan tidak ditemukan.');
    const payload = buildPayload(sub);

    // 4. Isi placeholder sesuai format template
    const isDocx = tplMime.includes('wordprocessingml') || tplName.toLowerCase().endsWith('.docx');
    const isText = tplMime.startsWith('text/') || /\.(txt|html?|md)$/i.test(tplName);
    let outBuffer: Buffer;
    let outExt: string;
    if (isDocx) {
      outBuffer = await fillDocx(tplBuffer, payload);
      outExt = '.docx';
    } else if (isText) {
      outBuffer = await fillText(tplBuffer, payload);
      outExt = extForMime(tplMime, tplName);
    } else {
      // Format tidak didukung untuk placeholder fill (mis. PDF) —
      // kembalikan template apa adanya dengan nama baru.
      outBuffer = tplBuffer;
      outExt = extForMime(tplMime, tplName);
    }

    // 5. Simpan hasil sebagai record baru di sk_files
    const nomor = (sub.surat as any)?.nomorSurat || sub.id;
    const safeNomor = String(nomor).replace(/[^\w.-]+/g, '_');
    const outName = `SK_${submissionId}__${safeNomor}${outExt}`;
    const outMime = isDocx
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : isText
        ? tplMime
        : tplMime;

    const uploaded = await storageAdapter.uploadFile(
      'sk' as StorageBucket,
      outBuffer,
      outName,
      outMime,
      { kind: 'generated', submissionId } as any
    );

    // 6. Resolve URL publik file hasil generate
    const record = await (storageAdapter as any).getRecord?.('sk', uploaded.fileId || uploaded.id);
    const url = record ? this.recordFileUrl(record) : uploaded.viewUrl;
    if (!url) throw new Error('Gagal membuat URL file SK.');

    return { url, name: outName, reused: false };
  }
}

export const skTemplateService = new SkTemplateService();
