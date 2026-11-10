import React from 'react';
import type { ThesisSubmission } from '../types';
import { StatusBadge } from './StatusBadge';
import { submissionService } from '../services/submissionService';
import {
  X,
  GraduationCap,
  FileText,
  User,
  Calendar,
  Building2,
  BookOpen,
  Award,
  ExternalLink,
  CheckCircle2,
  ShieldCheck,
  TableProperties,
  AlertTriangle,
} from 'lucide-react';

interface Props {
  submission: ThesisSubmission | null;
  onClose: () => void;
}

export const SubmissionDetailModal: React.FC<Props> = ({ submission, onClose }) => {
  if (!submission) return null;

  const formatDate = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-lg formal-dossier-modal">
        {/* Modal Header */}
        <div className="dossier-header">
          <div className="dossier-header-brand">
            <div className="dossier-icon-wrap">
              <GraduationCap size={28} color="#FFFFFF" />
            </div>
            <div>
              <div className="dossier-doc-type">BERKAS PENGAJUAN SKRIPSI RESMI</div>
              <div className="dossier-reg-num">
                NO. DOKUMEN: SPSM-{submission.$id.toUpperCase()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={submission.status} size="md" />
            <button onClick={onClose} className="modal-close-btn" title="Tutup">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body formal-dossier-body">
          {/* Metadata Banner */}
          <div className="dossier-meta-grid">
            <div className="dossier-meta-card">
              <div className="meta-card-label">
                <Calendar size={13} />
                <span>Tanggal Diajukan</span>
              </div>
              <div className="meta-card-val">{formatDate(submission.submitted_at || submission.$createdAt)}</div>
            </div>

            <div className="dossier-meta-card">
              <div className="meta-card-label">
                <Building2 size={13} />
                <span>Program Studi & Letting</span>
              </div>
              <div className="meta-card-val">
                {submission.student?.department || 'Teknik Informatika'} (Angkatan {submission.student?.batch_year || 2026})
              </div>
            </div>

            {submission.nomor_surat && (
              <div className="dossier-meta-card" style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
                <div className="meta-card-label text-emerald-700">
                  <Award size={13} />
                  <span>Nomor SK Pengesahan</span>
                </div>
                <div className="meta-card-val font-mono font-bold text-emerald-800">
                  {submission.nomor_surat} {submission.urutan_surat ? `(Urutan #${submission.urutan_surat})` : ''}
                </div>
              </div>
            )}

            <div className="dossier-meta-card">
              <div className="meta-card-label">
                <ShieldCheck size={13} />
                <span>Status Verifikasi</span>
              </div>
              <div className="meta-card-val text-primary font-semibold">
                {submission.status === 'approved'
                  ? 'Telah Disahkan Kaprodi'
                  : submission.status === 'waiting_kaprodi'
                  ? 'Menunggu Pengesahan Kaprodi'
                  : submission.status === 'revision'
                  ? 'Perlu Perbaikan Judul'
                  : submission.status === 'rejected'
                  ? 'Pengajuan Ditolak'
                  : 'Tahap Penilaian Reviewer'}
              </div>
            </div>
          </div>

          {/* Student Dossier */}
          <div className="formal-section-card">
            <div className="formal-section-title">
              <User size={16} color="#0A4C8F" />
              <span>Profil Mahasiswa Pemohon</span>
            </div>
            <div className="student-profile-info-grid">
              <div>
                <span className="profile-info-label">Nama Lengkap Mahasiswa:</span>
                <span className="profile-info-value font-bold text-slate-800">
                  {submission.student?.name || 'Mahasiswa'}
                </span>
              </div>
              <div>
                <span className="profile-info-label">Nomor Induk Mahasiswa (NIM):</span>
                <span className="profile-info-value font-mono">
                  {submission.student?.nim_or_nip || submission.student_id}
                </span>
              </div>
              <div>
                <span className="profile-info-label">Alamat Email Institusi:</span>
                <span className="profile-info-value">
                  {submission.student?.email || '-'}
                </span>
              </div>
              <div>
                <span className="profile-info-label">Dosen Pembimbing Ditetapkan:</span>
                <div className="profile-info-value text-primary font-semibold">
                  {submission.advisor ? (
                    <div>
                      <div>1. {submission.advisor.name} (NIP: {submission.advisor.nip})</div>
                      {submission.advisor2 && (
                        <div className="mt-0.5 text-slate-700">
                          2. {submission.advisor2.name} (NIP: {submission.advisor2.nip})
                        </div>
                      )}
                    </div>
                  ) : submission.preferredAdvisor1 || submission.preferredAdvisor2 ? (
                    <div className="text-blue-700">
                      <span className="italic text-slate-400 font-normal">Usulan Mahasiswa:</span>{' '}
                      1. {submission.preferredAdvisor1?.name || '-'}
                      {submission.preferredAdvisor2 && `, 2. ${submission.preferredAdvisor2.name}`}
                    </div>
                  ) : (
                    <span className="text-slate-400 font-normal italic">Belum ditetapkan</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Title Options Breakdown */}
          <div className="formal-section-card">
            <div className="formal-section-title">
              <BookOpen size={16} color="#0A4C8F" />
              <span>Daftar Usulan Opsi Judul Skripsi ({submission.options?.length || 0} Opsi)</span>
            </div>

            <div className="dossier-options-stack">
              {submission.options && submission.options.length > 0 ? (
                submission.options.map((opt) => {
                  const isSelected = opt.is_selected_by_lecturer;
                  const pdfUrl = opt.journal_file_id
                    ? submissionService.getFileViewUrl(opt.journal_file_id)
                    : null;

                  return (
                    <div
                      key={opt.$id}
                      className={`dossier-option-item ${
                        isSelected ? 'is-selected-option' : ''
                      }`}
                    >
                      <div className="dossier-option-top">
                        <div className="flex items-center gap-2">
                          <span className="option-badge-num">
                            Opsi {opt.option_number}
                          </span>
                          {isSelected && (
                            <span className="option-badge-approved">
                              <CheckCircle2 size={13} />
                              <span>Judul Terpilih / Disahkan</span>
                            </span>
                          )}
                        </div>
                        {pdfUrl && pdfUrl !== '#' && (
                          <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-pdf-link"
                          >
                            <FileText size={13} />
                            <span>Lihat PDF Jurnal</span>
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>

                      <h4 className="dossier-option-title">{opt.title}</h4>

                      <div className="dossier-option-bg">
                        <span className="dossier-label">Latar Belakang & Urgensi:</span>
                        <p>{opt.background}</p>
                      </div>

                      {/* Tabel Relevansi Penelitian (Spesifikasi v2.0) */}
                      {(opt.relevance_variable || opt.relevance_methodology || opt.relevance_note) && (
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 mt-2 text-xs">
                          <span className="dossier-label flex items-center gap-1.5 font-bold text-primary mb-1.5">
                            <TableProperties size={13} />
                            <span>Tabel Relevansi Penelitian:</span>
                          </span>
                          {opt.relevance_variable && (
                            <div className="mb-1">
                              <span className="font-semibold text-slate-600">Variabel / Fokus:</span>{' '}
                              <span className="text-slate-800">{opt.relevance_variable}</span>
                            </div>
                          )}
                          {opt.relevance_methodology && (
                            <div className="mb-1">
                              <span className="font-semibold text-slate-600">Metodologi Jurnal:</span>{' '}
                              <span className="text-slate-800">{opt.relevance_methodology}</span>
                            </div>
                          )}
                          {opt.relevance_note && (
                            <div>
                              <span className="font-semibold text-slate-600">Kesesuaian Topik:</span>{' '}
                              <span className="text-slate-800">{opt.relevance_note}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {(opt.journal_title || opt.journal_author) && (
                        <div className="dossier-journal-ref">
                          <span className="dossier-label">Jurnal Acuan Utama:</span>
                          <p className="font-medium text-slate-700">
                            {opt.journal_title || '-'}
                            {opt.journal_author ? ` — oleh ${opt.journal_author}` : ''}
                          </p>
                        </div>
                      )}

                      {/* Catatan Evaluasi Khusus Judul Ini */}
                      {opt.revision_note && (
                        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 mt-2 text-xs text-amber-900">
                          <span className="font-bold flex items-center gap-1 text-amber-800 mb-0.5">
                            <AlertTriangle size={13} />
                            <span>Catatan Evaluasi Khusus Judul Ini:</span>
                          </span>
                          <p>{opt.revision_note}</p>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-slate-400 italic text-sm">Data opsi judul tidak ditemukan.</p>
              )}
            </div>
          </div>

          {/* Dosen Pembimbing & Quota Status (Pembimbing 1 & Pembimbing 2) */}
          {submission.advisor && (
            <div className="formal-section-card advisor-focus-card">
              <div className="formal-section-title">
                <Award size={16} color="#0A4C8F" />
                <span>Informasi Dosen Pembimbing Ditetapkan</span>
              </div>
              <div className="space-y-3">
                {/* Pembimbing 1 */}
                <div className="advisor-detail-box">
                  <div className="advisor-detail-header">
                    <div>
                      <div className="text-xs font-bold text-primary uppercase tracking-wide">
                        Pembimbing 1 (Utama)
                      </div>
                      <h3 className="font-bold text-slate-800 text-base">{submission.advisor.name}</h3>
                      <div className="text-xs text-muted font-mono mt-0.5">
                        NIP: {submission.advisor.nip} • Departemen: {submission.advisor.department_id}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        Keahlian: <span className="font-medium">{submission.advisor.expertise || 'Komputer & Sistem'}</span>
                      </div>
                    </div>
                    <div className="advisor-quota-pill">
                      <span className="text-xs text-muted font-semibold">Beban Bimbingan:</span>
                      <span className="font-bold text-slate-800 text-sm">
                        {submission.advisor.current_students || 0} / {submission.advisor.quota} Mahasiswa
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pembimbing 2 jika ada */}
                {submission.advisor2 && (
                  <div className="advisor-detail-box">
                    <div className="advisor-detail-header">
                      <div>
                        <div className="text-xs font-bold text-teal-700 uppercase tracking-wide">
                          Pembimbing 2 (Pendamping)
                        </div>
                        <h3 className="font-bold text-slate-800 text-base">{submission.advisor2.name}</h3>
                        <div className="text-xs text-muted font-mono mt-0.5">
                          NIP: {submission.advisor2.nip} • Departemen: {submission.advisor2.department_id}
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Keahlian: <span className="font-medium">{submission.advisor2.expertise || 'Komputer & Sistem'}</span>
                        </div>
                      </div>
                      <div className="advisor-quota-pill">
                        <span className="text-xs text-muted font-semibold">Beban Bimbingan:</span>
                        <span className="font-bold text-slate-800 text-sm">
                          {submission.advisor2.current_students || 0} / {submission.advisor2.quota} Mahasiswa
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Formal SK Endorsement (If Approved) */}
          {submission.status === 'approved' && (
            <div className="certificate-endorsement-box">
              <div className="certificate-seal">
                <ShieldCheck size={32} color="#059669" />
              </div>
              <div className="certificate-content">
                <div className="cert-title">PENGESAHAN KETUA PROGRAM STUDI</div>
                <div className="cert-text">
                  Berdasarkan hasil verifikasi Dosen Penilai dan penetapan resmi Ketua Program Studi, usulan judul skripsi dan penunjukan Dosen Pembimbing atas nama <strong>{submission.student?.name || 'Mahasiswa'}</strong> telah memenuhi seluruh kriteria akademik dan dinyatakan <strong>RESMI DISAHKAN</strong>.
                </div>
                {submission.logs?.find((l) => l.action === 'DISAHKAN_KAPRODI')?.notes && (
                  <div className="cert-notes">
                    &ldquo;{submission.logs.find((l) => l.action === 'DISAHKAN_KAPRODI')?.notes}&rdquo;
                  </div>
                )}
                <div className="cert-officer">
                  Disahkan secara digital melalui SPSM Cloud
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
