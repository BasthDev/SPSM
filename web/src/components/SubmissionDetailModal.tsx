import React, { useState } from 'react';
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
  History,
  FileCheck,
  Printer,
  Sparkles,
} from 'lucide-react';

interface Props {
  submission: ThesisSubmission | null;
  onClose: () => void;
}

export const SubmissionDetailModal: React.FC<Props> = ({ submission, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'titles' | 'files' | 'logs'>('overview');

  if (!submission) return null;

  // File skripsi yang diupload mahasiswa (dari log UPLOAD_SKRSIPSI)
  const skripsiLog = [...(submission.logs || [])]
    .reverse()
    .find((l) => l.action === 'UPLOAD_SKRSIPSI');
  let uploadedThesis: { file_id: string; file_name?: string; size?: number } | null = null;
  if (skripsiLog?.notes) {
    try {
      const parsed = JSON.parse(skripsiLog.notes);
      if (parsed.file_id) {
        uploadedThesis = {
          file_id: parsed.file_id,
          file_name: parsed.file_name,
          size: parsed.size,
        };
      }
    } catch {
      // ignore
    }
  }
  const thesisFileUrl = uploadedThesis
    ? submissionService.getFileViewUrl(uploadedThesis.file_id)
    : null;

  const formatDate = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const docId = `SPSM-${submission.$id.toUpperCase().slice(-20)}`;

  const selectedOption = submission.options?.find((o) => o.is_selected_by_lecturer);

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-lg formal-dossier-modal">
        {/* Modal Header */}
        <div className="dossier-header">
          <div className="dossier-header-brand">
            <div className="dossier-icon-wrap">
              <GraduationCap size={26} color="#FFFFFF" />
            </div>
            <div>
              <div className="dossier-doc-type">BERKAS DOSSIER PENGAJUAN SKRIPSI</div>
              <div className="dossier-reg-num">
                NO. DOKUMEN: <span className="font-mono">{docId}</span>
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

        {/* Dossier Tabs Navigation */}
        <div className="dossier-tabs-nav">
          <button
            type="button"
            className={`dossier-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <User size={15} />
            <span>Ringkasan Pengajuan</span>
          </button>
          <button
            type="button"
            className={`dossier-tab-btn ${activeTab === 'titles' ? 'active' : ''}`}
            onClick={() => setActiveTab('titles')}
          >
            <BookOpen size={15} />
            <span>Usulan Judul & Relevansi ({submission.options?.length || 0})</span>
          </button>
          <button
            type="button"
            className={`dossier-tab-btn ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            <FileCheck size={15} />
            <span>Berkas & SK Pengesahan</span>
            {submission.nomor_surat && <span className="tab-pill-indicator">SK Aktif</span>}
          </button>
          <button
            type="button"
            className={`dossier-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <History size={15} />
            <span>Riwayat & Audit Log ({submission.logs?.length || 0})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body formal-dossier-body">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
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
                    <span>Program Studi & Angkatan</span>
                  </div>
                  <div className="meta-card-val">
                    {submission.student?.department || 'Teknik Informatika'} (Angkatan {submission.student?.batch_year || 2026})
                  </div>
                </div>

                {submission.nomor_surat && (
                  <div className="dossier-meta-card border-emerald-200 bg-emerald-50">
                    <div className="meta-card-label text-emerald-700">
                      <Award size={13} />
                      <span>Nomor SK Pengesahan</span>
                    </div>
                    <div className="meta-card-val font-mono font-bold text-emerald-800">
                      {submission.nomor_surat} {submission.urutan_surat ? `(#${submission.urutan_surat})` : ''}
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
                    <span className="profile-info-label">Program Studi:</span>
                    <span className="profile-info-value">
                      {submission.student?.department || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Selected / Highlighted Title if any */}
              {selectedOption && (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="option-badge-approved">
                      <CheckCircle2 size={13} />
                      <span>Judul Terpilih (Opsi {selectedOption.option_number})</span>
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-base leading-snug">{selectedOption.title}</h4>
                  <p className="text-xs text-slate-600 mt-2 line-clamp-3">{selectedOption.background}</p>
                </div>
              )}

              {/* Dosen Pembimbing Ditetapkan */}
              <div className="formal-section-card">
                <div className="formal-section-title">
                  <Award size={16} color="#0A4C8F" />
                  <span>Dosen Pembimbing yang Ditugaskan</span>
                </div>
                {submission.advisor ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="text-xs font-bold text-primary uppercase tracking-wide">
                        Pembimbing 1 (Utama)
                      </div>
                      <div className="font-bold text-slate-800 text-sm mt-1">{submission.advisor.name}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">NIP: {submission.advisor.nip}</div>
                      <div className="text-xs text-slate-600 mt-1">
                        Keahlian: {submission.advisor.expertise || 'Bidang Keilmuan'}
                      </div>
                    </div>
                    {submission.advisor2 ? (
                      <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="text-xs font-bold text-primary uppercase tracking-wide">
                          Pembimbing 2 (Pendamping)
                        </div>
                        <div className="font-bold text-slate-800 text-sm mt-1">{submission.advisor2.name}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">NIP: {submission.advisor2.nip}</div>
                        <div className="text-xs text-slate-600 mt-1">
                          Keahlian: {submission.advisor2.expertise || 'Bidang Keilmuan'}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-center text-xs text-slate-400 italic">
                        Pembimbing 2 belum ditetapkan
                      </div>
                    )}
                  </div>
                ) : submission.preferredAdvisor1 || submission.preferredAdvisor2 ? (
                  <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200 text-xs text-blue-900 mt-2">
                    <span className="font-bold">Usulan Pilihan Dosen oleh Mahasiswa:</span>
                    <ul className="list-disc ml-5 mt-1 space-y-0.5">
                      {submission.preferredAdvisor1 && (
                        <li>Pilihan 1: {submission.preferredAdvisor1.name} (NIP: {submission.preferredAdvisor1.nip})</li>
                      )}
                      {submission.preferredAdvisor2 && (
                        <li>Pilihan 2: {submission.preferredAdvisor2.name} (NIP: {submission.preferredAdvisor2.nip})</li>
                      )}
                    </ul>
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-xs mt-2">Dosen pembimbing belum ditetapkan oleh Dosen Penilai / Kaprodi.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TITLES & RELEVANCE */}
          {activeTab === 'titles' && (
            <div className="space-y-4">
              <div className="formal-section-title">
                <BookOpen size={16} color="#0A4C8F" />
                <span>Daftar Usulan 3 Opsi Judul Skripsi</span>
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
                              <span>Lihat Jurnal Pendukung</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>

                        <h4 className="dossier-option-title">{opt.title}</h4>

                        <div className="dossier-option-bg">
                          <span className="dossier-label">Latar Belakang & Rumusan Masalah:</span>
                          <p>{opt.background}</p>
                        </div>

                        {/* Tabel Relevansi Penelitian */}
                        {(opt.relevance_variable || opt.relevance_methodology || opt.relevance_note) && (
                          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 mt-2 text-xs">
                            <span className="dossier-label flex items-center gap-1.5 font-bold text-primary mb-1.5">
                              <TableProperties size={13} />
                              <span>Tabel Relevansi Penelitian:</span>
                            </span>
                            {opt.relevance_variable && (
                              <div className="mb-1">
                                <span className="font-semibold text-slate-600">Variabel / Objek Penelitian:</span>{' '}
                                <span className="text-slate-800">{opt.relevance_variable}</span>
                              </div>
                            )}
                            {opt.relevance_methodology && (
                              <div className="mb-1">
                                <span className="font-semibold text-slate-600">Metodologi / Algoritma Jurnal:</span>{' '}
                                <span className="text-slate-800">{opt.relevance_methodology}</span>
                              </div>
                            )}
                            {opt.relevance_note && (
                              <div>
                                <span className="font-semibold text-slate-600">Kesesuaian & Kontribusi:</span>{' '}
                                <span className="text-slate-800">{opt.relevance_note}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {(opt.journal_title || opt.journal_author || opt.journal_year) && (
                          <div className="dossier-journal-ref">
                            <span className="dossier-label">Jurnal Acuan Utama:</span>
                            <p className="font-medium text-slate-700">
                              {opt.journal_title || '-'}
                              {opt.journal_author ? ` — oleh ${opt.journal_author}` : ''}
                              {opt.journal_year ? ` (${opt.journal_year})` : ''}
                            </p>
                          </div>
                        )}

                        {opt.revision_note && (
                          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 mt-2 text-xs text-amber-900">
                            <span className="font-bold flex items-center gap-1 text-amber-800 mb-0.5">
                              <AlertTriangle size={13} />
                              <span>Catatan Peninjau untuk Opsi Ini:</span>
                            </span>
                            <p>{opt.revision_note}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-slate-400 italic text-sm">Data usulan opsi judul tidak ditemukan.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: FILES & SK PENGESAHAN */}
          {activeTab === 'files' && (
            <div className="space-y-4">
              {/* Formal SK Certificate If Approved */}
              {submission.status === 'approved' ? (
                <div className="certificate-endorsement-box">
                  <div className="certificate-seal">
                    <ShieldCheck size={36} color="#059669" />
                  </div>
                  <div className="certificate-content">
                    <div className="cert-title">SURAT KEPUTUSAN PENGESAHAN JUDUL & DOSEN PEMBIMBING</div>
                    <div className="text-xs font-mono font-bold text-emerald-800 mt-0.5">
                      NOMOR: {submission.nomor_surat || '-'}
                    </div>
                    <div className="cert-text mt-2">
                      Berdasarkan hasil rapat penetapan Dosen Penilai dan Surat Keputusan Ketua Program Studi{' '}
                      <strong>{submission.student?.department || 'Program Studi'}</strong>, judul skripsi yang diusulkan oleh mahasiswa:{' '}
                      <strong>{submission.student?.name}</strong> (NIM: {submission.student?.nim_or_nip}) dengan judul:{' '}
                      <em>&ldquo;{selectedOption?.title || 'Judul Terpilih'}&rdquo;</em> telah dinyatakan <strong>RESMI DISAHKAN</strong> dan memenuhi syarat akademik.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 p-3 bg-white/80 rounded-lg border border-emerald-200 text-xs">
                      <div>
                        <span className="text-slate-500">Dosen Pembimbing 1:</span>
                        <div className="font-bold text-slate-800">{submission.advisor?.name || '-'}</div>
                      </div>
                      <div>
                        <span className="text-slate-500">Dosen Pembimbing 2:</span>
                        <div className="font-bold text-slate-800">{submission.advisor2?.name || '-'}</div>
                      </div>
                    </div>
                    {submission.logs?.find((l) => l.action === 'DISAHKAN_KAPRODI')?.notes && (
                      <div className="cert-notes mt-2">
                        Catatan Kaprodi: &ldquo;{submission.logs.find((l) => l.action === 'DISAHKAN_KAPRODI')?.notes}&rdquo;
                      </div>
                    )}
                    <div className="cert-officer mt-3 flex items-center justify-between">
                      <span>Dokumen Resmi Disahkan secara Elektronik oleh Sistem Informasi SPSM</span>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="btn-print-sk"
                      >
                        <Printer size={13} />
                        <span>Cetak Dokumen SK</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center py-8">
                  <Award size={32} className="mx-auto text-slate-400 mb-2" />
                  <h4 className="font-bold text-slate-700 text-sm">Surat Keputusan (SK) Belum Terbit</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Surat keputusan beserta Nomor Surat resmi akan diterbitkan otomatis setelah usulan disahkan oleh Ketua Program Studi (Kaprodi).
                  </p>
                </div>
              )}

              {/* File Skripsi yang Diupload Mahasiswa */}
              {uploadedThesis && thesisFileUrl && thesisFileUrl !== '#' && (
                <div className="formal-section-card">
                  <div className="formal-section-title">
                    <FileText size={16} color="#0A4C8F" />
                    <span>Naskah / Draft Skripsi Mahasiswa</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 text-sm truncate">
                        {uploadedThesis.file_name || 'Draft_Skripsi_Lengkap.pdf'}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Diupload pada: {formatDate(skripsiLog?.created_at)}
                        {uploadedThesis.size ? ` • ${(uploadedThesis.size / 1024 / 1024).toFixed(2)} MB` : ''}
                      </div>
                    </div>
                    <a
                      href={thesisFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-pdf-link shrink-0"
                    >
                      <FileText size={13} />
                      <span>Unduh Naskah</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="formal-section-title">
                <History size={16} color="#0A4C8F" />
                <span>Riwayat Jejak Audit & Alur Persetujuan</span>
              </div>
              {submission.logs && submission.logs.length > 0 ? (
                <div className="timeline-container">
                  {submission.logs.map((log) => {
                    const isApproved = log.action === 'DISAHKAN_KAPRODI';
                    const isRevision = log.action === 'MINTA_REVISI';
                    const isRejected = log.action === 'DITOLAK';
                    const isReviewer = log.action === 'VERIFIKASI_DOSEN_PENILAI';

                    return (
                      <div key={log.$id} className="timeline-item">
                        <div
                          className={`timeline-dot ${
                            isApproved
                              ? 'dot-approved'
                              : isRevision
                              ? 'dot-revision'
                              : isRejected
                              ? 'dot-rejected'
                              : isReviewer
                              ? 'dot-reviewer'
                              : 'dot-default'
                          }`}
                        />
                        <div className="timeline-card">
                          <div className="timeline-header">
                            <span className="timeline-action-label">
                              {log.action.replace(/_/g, ' ')}
                            </span>
                            <span className="timeline-date">{formatDate(log.created_at)}</span>
                          </div>
                          {log.notes && (
                            <p className="timeline-notes">
                              &ldquo;{log.notes}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-400 italic text-sm text-center py-6">
                  Belum ada catatan riwayat verifikasi untuk pengajuan ini.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer flex items-center justify-between">
          <div className="text-xs text-slate-500">
            SPSM Portal • Dokumen Resmi Akademik
          </div>
          <button type="button" onClick={onClose} className="btn-secondary">
            Tutup Berkas
          </button>
        </div>
      </div>
    </div>
  );
};
