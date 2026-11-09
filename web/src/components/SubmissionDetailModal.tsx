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
  Clock,
  Printer,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';

interface Props {
  submission: ThesisSubmission | null;
  onClose: () => void;
}

export const SubmissionDetailModal: React.FC<Props> = ({ submission, onClose }) => {
  if (!submission) return null;

  const selectedOption =
    submission.options?.find((o) => o.is_selected_by_lecturer) ||
    submission.options?.[0];

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

  const handlePrint = () => {
    window.print();
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
                <span className="profile-info-value text-primary font-semibold">
                  {submission.advisor?.name ? (
                    `${submission.advisor.name} (NIP: ${submission.advisor.nip})`
                  ) : (
                    <span className="text-slate-400 font-normal italic">Belum ditetapkan</span>
                  )}
                </span>
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

                      {(opt.journal_title || opt.journal_author) && (
                        <div className="dossier-journal-ref">
                          <span className="dossier-label">Jurnal Acuan Utama:</span>
                          <p className="font-medium text-slate-700">
                            {opt.journal_title || '-'}
                            {opt.journal_author ? ` — oleh ${opt.journal_author}` : ''}
                          </p>
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

          {/* Dosen Pembimbing & Quota Status */}
          {submission.advisor && (
            <div className="formal-section-card advisor-focus-card">
              <div className="formal-section-title">
                <Award size={16} color="#0A4C8F" />
                <span>Informasi Dosen Pembimbing Terpilih</span>
              </div>
              <div className="advisor-detail-box">
                <div className="advisor-detail-header">
                  <div>
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
                    Catatan Kaprodi: "{submission.logs?.find((l) => l.action === 'DISAHKAN_KAPRODI')?.notes}"
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Audit Trail / Riwayat Keputusan */}
          <div className="formal-section-card">
            <div className="formal-section-title">
              <Clock size={16} color="#0A4C8F" />
              <span>Riwayat Keputusan & Log Akademik</span>
            </div>

            <div className="timeline-trail">
              {submission.logs && submission.logs.length > 0 ? (
                submission.logs.map((log) => (
                  <div key={log.$id} className="timeline-node">
                    <div className="timeline-marker" />
                    <div className="timeline-content">
                      <div className="timeline-meta">
                        <span className="timeline-actor">{log.actor_id}</span>
                        <span className="timeline-action-badge">{log.action}</span>
                        <span className="timeline-date">{formatDate(log.created_at)}</span>
                      </div>
                      {log.notes && <p className="timeline-note-text">"{log.notes}"</p>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 italic text-sm">Belum ada riwayat tercatat.</div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer flex items-center justify-between">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <Printer size={15} />
            <span>Cetak Berkas Dossier</span>
          </button>
          <button onClick={onClose} className="btn-primary">
            Selesai / Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
