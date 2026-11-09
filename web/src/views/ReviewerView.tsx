import React, { useState, useEffect } from 'react';
import { submissionService } from '../services/submissionService';
import { lecturerService } from '../services/lecturerService';
import { StatusBadge } from '../components/StatusBadge';
import { SubmissionDetailModal } from '../components/SubmissionDetailModal';
import type { ThesisSubmission, Lecturer, SubmissionStatus } from '../types';
import {
  FileText,
  CheckCircle,
  Clock,
  RotateCcw,
  User,
  ExternalLink,
  ChevronRight,
  X,
  Send,
  AlertTriangle,
  Info,
  Eye,
} from 'lucide-react';

interface Props {
  reviewerName: string;
}

export const ReviewerView: React.FC<Props> = ({ reviewerName }) => {
  const [submissions, setSubmissions] = useState<ThesisSubmission[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<string>('pending_lecturer');
  const [selectedSub, setSelectedSub] = useState<ThesisSubmission | null>(null);
  const [activeDossierSub, setActiveDossierSub] = useState<ThesisSubmission | null>(null);

  // Review Form state
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [subs, lecs] = await Promise.all([
        submissionService.getAllSubmissions(),
        lecturerService.getLecturers(),
      ]);
      setSubmissions(subs);
      setLecturers(lecs);
    } catch (err: any) {
      showFeedback(`Gagal memuat data: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = (sub: ThesisSubmission) => {
    setSelectedSub(sub);
    // Find already selected option if any, else default to option 1
    const alreadySelected = sub.options?.find((o) => o.is_selected_by_lecturer);
    setSelectedOptionId(alreadySelected?.$id || sub.options?.[0]?.$id || '');
    setSelectedAdvisorId(sub.advisor_id || '');
    setReviewNotes('');
  };

  // Submit review: Choose title & assign advisor, forward to Kaprodi
  const handleSubmitForwardToKaprodi = async () => {
    if (!selectedSub) return;
    if (!selectedOptionId) {
      showFeedback('Pilih salah satu dari 3 opsi judul yang disetujui!', 'error');
      return;
    }
    if (!selectedAdvisorId) {
      showFeedback('Pilih Dosen Pembimbing untuk mahasiswa ini!', 'error');
      return;
    }

    setActionLoading(true);
    try {
      await submissionService.reviewAndSelectTitle(
        selectedSub.$id,
        selectedOptionId,
        selectedAdvisorId,
        reviewerName,
        reviewNotes
      );
      showFeedback('Verifikasi berhasil! Pengajuan telah diteruskan ke Kaprodi untuk pengesahan final.');
      setSelectedSub(null);
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal memproses verifikasi: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Request revision
  const handleRequestRevision = async () => {
    if (!selectedSub) return;
    if (!reviewNotes) {
      showFeedback('Berikan catatan revisi agar mahasiswa tahu apa yang harus diperbaiki!', 'error');
      return;
    }

    setActionLoading(true);
    try {
      await submissionService.requestRevision(selectedSub.$id, reviewerName, reviewNotes);
      showFeedback('Status pengajuan berhasil diubah menjadi Perlu Revisi.');
      setSelectedSub(null);
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject submission
  const handleReject = async () => {
    if (!selectedSub) return;
    if (!reviewNotes) {
      showFeedback('Berikan alasan penolakan pada kolom catatan!', 'error');
      return;
    }
    if (!confirm('Apakah Anda yakin ingin menolak pengajuan ini? Mahasiswa akan dapat mengajukan ulang.')) {
      return;
    }

    setActionLoading(true);
    try {
      await submissionService.rejectSubmission(selectedSub.$id, reviewerName, reviewNotes);
      showFeedback('Pengajuan telah ditolak.');
      setSelectedSub(null);
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredSubmissions = submissions.filter((s) => {
    if (activeFilter === 'all') return true;
    return s.status === activeFilter;
  });

  const pendingCount = submissions.filter((s) => s.status === 'pending_lecturer').length;
  const waitingKaprodiCount = submissions.filter((s) => s.status === 'waiting_kaprodi').length;
  const approvedCount = submissions.filter((s) => s.status === 'approved').length;

  return (
    <div className="reviewer-container">
      {/* Toast Feedback */}
      {feedback && (
        <div className={`feedback-toast ${feedback.type}`}>
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header & Stats */}
      <div className="section-header">
        <div>
          <h1 className="page-title">Panel Reviewer Dosen Penilai</h1>
          <p className="page-desc">
            Tinjau 3 usulan judul mahasiswa, pilih 1 judul terbaik, dan tetapkan Dosen Pembimbing yang relevan.
          </p>
        </div>
      </div>

      {/* Quick Stat Cards */}
      <div className="stat-grid">
        <div
          className={`stat-card ${activeFilter === 'pending_lecturer' ? 'active' : ''}`}
          onClick={() => setActiveFilter('pending_lecturer')}
        >
          <div className="stat-icon warning">
            <Clock size={20} />
          </div>
          <div>
            <div className="stat-number">{pendingCount}</div>
            <div className="stat-label">Menunggu Review Dosen</div>
          </div>
        </div>

        <div
          className={`stat-card ${activeFilter === 'waiting_kaprodi' ? 'active' : ''}`}
          onClick={() => setActiveFilter('waiting_kaprodi')}
        >
          <div className="stat-icon info">
            <Send size={20} />
          </div>
          <div>
            <div className="stat-number">{waitingKaprodiCount}</div>
            <div className="stat-label">Menunggu Pengesahan Kaprodi</div>
          </div>
        </div>

        <div
          className={`stat-card ${activeFilter === 'approved' ? 'active' : ''}`}
          onClick={() => setActiveFilter('approved')}
        >
          <div className="stat-icon success">
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="stat-number">{approvedCount}</div>
            <div className="stat-label">Telah Disetujui</div>
          </div>
        </div>
      </div>

      {/* Submissions List */}
      <div className="card mt-6">
        <div className="card-top-action">
          <h3 className="card-subhead">Daftar Pengajuan Judul Mahasiswa</h3>
          <div className="tab-pill-group">
            <button
              onClick={() => setActiveFilter('pending_lecturer')}
              className={`tab-pill-btn ${activeFilter === 'pending_lecturer' ? 'active' : ''}`}
            >
              Menunggu Review ({pendingCount})
            </button>
            <button
              onClick={() => setActiveFilter('waiting_kaprodi')}
              className={`tab-pill-btn ${activeFilter === 'waiting_kaprodi' ? 'active' : ''}`}
            >
              Ke Kaprodi ({waitingKaprodiCount})
            </button>
            <button
              onClick={() => setActiveFilter('all')}
              className={`tab-pill-btn ${activeFilter === 'all' ? 'active' : ''}`}
            >
              Semua Pengajuan ({submissions.length})
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Mahasiswa</th>
                <th>Jurusan & Angkatan</th>
                <th>Tanggal Pengajuan</th>
                <th>Usulan Judul</th>
                <th>Status</th>
                <th>Dosen Pembimbing</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted">
                    Tidak ada pengajuan pada kategori ini.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => {
                  const student = sub.student;
                  const chosenOption = sub.options?.find((o) => o.is_selected_by_lecturer);
                  return (
                    <tr key={sub.$id}>
                      <td>
                        <div className="font-semibold text-slate-800">
                          {student?.name || 'Mahasiswa'}
                        </div>
                        <div className="text-xs text-muted font-mono">
                          NIM: {student?.nim_or_nip || sub.student_id}
                        </div>
                      </td>
                      <td>
                        <div>{student?.department || '-'}</div>
                        <div className="text-xs text-muted">{student?.batch_year || '-'}</div>
                      </td>
                      <td className="text-xs text-slate-500 font-mono">
                        {new Date(
                          sub.submitted_at || sub.$createdAt || Date.now()
                        ).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="max-w-md">
                        {chosenOption ? (
                          <div className="text-xs">
                            <span className="badge badge-success-outline mr-1">
                              Opsi {chosenOption.option_number}
                            </span>
                            <span className="font-medium text-slate-800">{chosenOption.title}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-muted">
                            3 opsi judul diajukan:
                            <div className="truncate font-medium text-slate-700">
                              1. {sub.options?.[0]?.title || '-'}
                            </div>
                          </div>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={sub.status} size="sm" />
                      </td>
                      <td>
                        {sub.advisor ? (
                          <div className="text-xs font-medium text-slate-800">
                            {sub.advisor.name}
                          </div>
                        ) : (
                          <span className="text-xs text-muted italic">Belum diplot</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setActiveDossierSub(sub)}
                            className="btn-sm btn-secondary"
                            title="Lihat Berkas Lengkap"
                          >
                            <Eye size={13} />
                            <span>Berkas</span>
                          </button>
                          <button
                            onClick={() => handleOpenReview(sub)}
                            className="btn-sm btn-primary"
                          >
                            <span>Tinjau</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL TINJAU & PLOTTING DOSEN */}
      {selectedSub && (
        <div className="modal-backdrop">
          <div className="modal-card modal-large">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Tinjau Pengajuan Judul Skripsi</h3>
                <p className="text-xs text-muted">
                  Mahasiswa: {selectedSub.student?.name} (NIM: {selectedSub.student?.nim_or_nip}) -{' '}
                  {selectedSub.student?.department}
                </p>
              </div>
              <button onClick={() => setSelectedSub(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Option Cards Comparison */}
              <div className="title-options-review-grid">
                {selectedSub.options?.map((opt) => {
                  const isChecked = selectedOptionId === opt.$id;
                  const fileUrl = opt.journal_file_id
                    ? submissionService.getFileViewUrl(opt.journal_file_id)
                    : null;

                  return (
                    <div
                      key={opt.$id}
                      onClick={() => setSelectedOptionId(opt.$id)}
                      className={`option-review-card ${isChecked ? 'selected' : ''}`}
                    >
                      <div className="option-header">
                        <div className="option-badge">Opsi {opt.option_number}</div>
                        <input
                          type="radio"
                          name="selected_title"
                          checked={isChecked}
                          onChange={() => setSelectedOptionId(opt.$id)}
                        />
                      </div>

                      <h4 className="option-title">{opt.title}</h4>

                      <div className="option-section">
                        <span className="option-label">Latar Belakang & Rumusan:</span>
                        <p className="option-text">{opt.background}</p>
                      </div>

                      <div className="option-section">
                        <span className="option-label">Jurnal Acuan:</span>
                        <p className="option-journal">
                          <strong>{opt.journal_title}</strong>
                          <br />
                          <span className="text-muted">Penulis: {opt.journal_author}</span>
                        </p>
                      </div>

                      {fileUrl && fileUrl !== '#' && (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="file-link-btn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={14} />
                          <span>Lihat PDF Jurnal</span>
                        </a>
                      )}

                      {isChecked && (
                        <div className="selected-indicator">
                          <CheckCircle size={14} />
                          <span>Judul Terpilih</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Plotting Dosen Pembimbing */}
              <div className="review-action-section">
                <h4 className="section-subtitle">
                  <User size={16} />
                  <span>Plotting Dosen Pembimbing</span>
                </h4>
                <p className="text-xs text-muted mb-2">
                  Pilih Dosen Pembimbing yang memiliki keahlian sesuai dengan judul yang dipilih. Perhatikan kuota bimbingan masing-masing dosen.
                </p>

                <div className="form-group">
                  <label>Pilih Dosen Pembimbing *</label>
                  <select
                    value={selectedAdvisorId}
                    onChange={(e) => setSelectedAdvisorId(e.target.value)}
                    className="select-advisor"
                  >
                    <option value="">-- Pilih Dosen Pembimbing --</option>
                    {lecturers
                      .filter((l) => l.is_active)
                      .map((lec) => {
                        const remaining = (lec.quota || 10) - (lec.current_students || 0);
                        const isFull = remaining <= 0;
                        return (
                          <option key={lec.$id} value={lec.$id} disabled={isFull}>
                            {lec.name} [{lec.department_id}] - Keahlian: {lec.expertise || 'Umum'} (Sisa Kuota: {remaining} mhs){isFull ? ' - [KUOTA PENUH]' : ''}
                          </option>
                        );
                      })}
                  </select>
                </div>

                <div className="form-group">
                  <label>Catatan Reviewer / Alasan Pemilihan Judul & Dosen</label>
                  <textarea
                    rows={3}
                    placeholder="Contoh: Judul 2 dipilih karena urgensi dan ketersediaan data yang valid. Calon pembimbing Dr. Ahmad sangat kompeten di bidang Machine Learning."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer justify-between">
              <div className="footer-left-buttons">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleRequestRevision}
                  className="btn btn-warning"
                >
                  <RotateCcw size={16} />
                  <span>Minta Revisi</span>
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleReject}
                  className="btn btn-danger-outline"
                >
                  Tolak Pengajuan
                </button>
              </div>

              <div className="footer-right-buttons">
                <button
                  type="button"
                  onClick={() => setSelectedSub(null)}
                  className="btn btn-secondary"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleSubmitForwardToKaprodi}
                  className="btn btn-primary"
                >
                  <Send size={16} />
                  <span>{actionLoading ? 'Menyimpan...' : 'Teruskan ke Kaprodi'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formal Dossier Modal */}
      <SubmissionDetailModal
        submission={activeDossierSub}
        onClose={() => setActiveDossierSub(null)}
      />
    </div>
  );
};
