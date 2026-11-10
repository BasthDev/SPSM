import React, { useState, useEffect } from 'react';
import { submissionService } from '../services/submissionService';
import { lecturerService } from '../services/lecturerService';
import { StatusBadge } from '../components/StatusBadge';
import { SubmissionDetailModal } from '../components/SubmissionDetailModal';
import type { ThesisSubmission, Lecturer } from '../types';
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
  Award,
  TableProperties,
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

  // Review Form state: 2 Advisors
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [selectedAdvisor1Id, setSelectedAdvisor1Id] = useState<string>('');
  const [selectedAdvisor2Id, setSelectedAdvisor2Id] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Structured Rejection / Revision Modal state
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    type: 'revision' | 'rejected';
    noteOpt1: string;
    noteOpt2: string;
    noteOpt3: string;
    generalNotes: string;
  } | null>(null);

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
    const alreadySelected = sub.options?.find((o) => o.is_selected_by_lecturer);
    setSelectedOptionId(alreadySelected?.$id || sub.options?.[0]?.$id || '');

    // Set advisors from existing assignment or fallback to student's preferred advisors
    setSelectedAdvisor1Id(
      sub.advisor?.$id || sub.preferredAdvisor1?.$id || lecturers[0]?.$id || ''
    );
    setSelectedAdvisor2Id(
      sub.advisor2?.$id || sub.preferredAdvisor2?.$id || ''
    );
    setReviewNotes('');
  };

  // Submit review: Choose title & assign BOTH advisors, forward to Kaprodi
  const handleSubmitForwardToKaprodi = async () => {
    if (!selectedSub) return;
    if (!selectedOptionId) {
      showFeedback('Pilih salah satu dari 3 opsi judul yang disetujui!', 'error');
      return;
    }
    if (!selectedAdvisor1Id) {
      showFeedback('Pilih Dosen Pembimbing 1 (Utama) untuk mahasiswa ini!', 'error');
      return;
    }
    if (selectedAdvisor1Id && selectedAdvisor2Id && selectedAdvisor1Id === selectedAdvisor2Id) {
      showFeedback('Dosen Pembimbing 1 dan Dosen Pembimbing 2 tidak boleh orang yang sama!', 'error');
      return;
    }

    setActionLoading(true);
    try {
      await submissionService.reviewAndSelectTitle(
        selectedSub.$id,
        selectedOptionId,
        selectedAdvisor1Id,
        selectedAdvisor2Id,
        reviewerName,
        reviewNotes
      );
      showFeedback('Verifikasi berhasil! Judul terpilih dan 2 Dosen Pembimbing telah diteruskan ke Kaprodi.');
      setSelectedSub(null);
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal memproses verifikasi: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Structured Rejection or Revision Modal
  const openDecisionModal = (type: 'revision' | 'rejected') => {
    if (!selectedSub) return;
    setRejectModal({
      isOpen: true,
      type,
      noteOpt1: '',
      noteOpt2: '',
      noteOpt3: '',
      generalNotes: reviewNotes || '',
    });
  };

  // Submit Structured Rejection or Revision
  const handleConfirmDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub || !rejectModal) return;

    if (!rejectModal.noteOpt1 && !rejectModal.noteOpt2 && !rejectModal.noteOpt3) {
      showFeedback('Harap berikan catatan minimal untuk salah satu opsi judul!', 'error');
      return;
    }

    setActionLoading(true);
    try {
      if (rejectModal.type === 'revision') {
        await submissionService.requestRevision(
          selectedSub.$id,
          reviewerName,
          rejectModal.noteOpt1,
          rejectModal.noteOpt2,
          rejectModal.noteOpt3,
          rejectModal.generalNotes,
          selectedSub.advisor_id
        );
        showFeedback('Status pengajuan diubah menjadi Perlu Revisi. Ketiga opsi memuat catatan.');
      } else {
        await submissionService.rejectSubmission(
          selectedSub.$id,
          reviewerName,
          rejectModal.noteOpt1,
          rejectModal.noteOpt2,
          rejectModal.noteOpt3,
          rejectModal.generalNotes,
          selectedSub.advisor_id
        );
        showFeedback('Pengajuan telah ditolak. Ketiga opsi ditandai ditolak dengan catatan.');
      }

      setRejectModal(null);
      setSelectedSub(null);
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter Submissions
  const filteredSubmissions = submissions.filter((sub) => {
    if (activeFilter === 'all') return true;
    return sub.status === activeFilter;
  });

  // Calculate Metrics (Aggregating verified submissions)
  const totalVerified = submissionService.calculateTotalVerified(submissions);
  const pendingCount = submissions.filter((s) => s.status === 'pending_lecturer').length;
  const waitingKaprodiCount = submissions.filter((s) => s.status === 'waiting_kaprodi').length;
  const approvedCount = submissions.filter((s) => s.status === 'approved').length;
  const rejectedCount = submissions.filter((s) => s.status === 'rejected' || s.status === 'revision').length;

  return (
    <div className="reviewer-container">
      {/* Toast Feedback */}
      {feedback && (
        <div className={`feedback-toast ${feedback.type}`}>
          <AlertTriangle size={18} />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="page-title">Panel Verifikasi Dosen Penilai (Reviewer)</h1>
          <p className="page-desc">
            Periksa kelayakan proposal 3 judul skripsi, telaah tabel relevansi penelitian, dan plot 2 Dosen Pembimbing.
          </p>
        </div>
      </div>

      {/* Metric Cards Bar */}
      <div className="stat-metric-bar">
        <div className="metric-card">
          <div className="metric-icon-circle" style={{ backgroundColor: '#EFF6FF', color: '#0A4C8F' }}>
            <Clock size={20} />
          </div>
          <div>
            <div className="metric-val">{pendingCount}</div>
            <div className="metric-label">Perlu Diperiksa</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
            <Award size={20} />
          </div>
          <div>
            <div className="metric-val">{totalVerified}</div>
            <div className="metric-label">Pengajuan Sah / Terverifikasi</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="metric-val">{approvedCount}</div>
            <div className="metric-label">Disahkan Kaprodi</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
            <RotateCcw size={20} />
          </div>
          <div>
            <div className="metric-val">{rejectedCount}</div>
            <div className="metric-label">Revisi / Ditolak</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-pill-bar">
        <button
          onClick={() => setActiveFilter('pending_lecturer')}
          className={`filter-pill ${activeFilter === 'pending_lecturer' ? 'active' : ''}`}
        >
          <span>Menunggu Review</span>
          <span className="filter-pill-badge">{pendingCount}</span>
        </button>
        <button
          onClick={() => setActiveFilter('waiting_kaprodi')}
          className={`filter-pill ${activeFilter === 'waiting_kaprodi' ? 'active' : ''}`}
        >
          <span>Diteruskan ke Kaprodi</span>
          <span className="filter-pill-badge">{waitingKaprodiCount}</span>
        </button>
        <button
          onClick={() => setActiveFilter('approved')}
          className={`filter-pill ${activeFilter === 'approved' ? 'active' : ''}`}
        >
          <span>Disahkan</span>
          <span className="filter-pill-badge">{approvedCount}</span>
        </button>
        <button
          onClick={() => setActiveFilter('all')}
          className={`filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
        >
          <span>Semua Pengajuan</span>
          <span className="filter-pill-badge">{submissions.length}</span>
        </button>
      </div>

      {/* Submissions Table */}
      <div className="table-card">
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Mahasiswa & NIM</th>
                <th>Prodi & Letting</th>
                <th>Usulan Judul & Opsi Terpilih</th>
                <th>Status</th>
                <th>Dosen Pembimbing Diplot</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted">
                    {loading ? 'Memuat data pengajuan...' : 'Tidak ada pengajuan pada kategori ini.'}
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => {
                  const selectedOpt =
                    sub.options?.find((o) => o.is_selected_by_lecturer) || sub.options?.[0];

                  return (
                    <tr key={sub.$id}>
                      <td>
                        <div className="font-bold text-slate-800">{sub.student?.name || 'Mahasiswa'}</div>
                        <div className="text-xs text-muted font-mono">{sub.student?.nim_or_nip}</div>
                      </td>
                      <td>
                        <span className="dept-badge">{sub.student?.department || 'TI'}</span>
                        <div className="text-xs text-muted mt-1">Letting {sub.student?.batch_year || 2026}</div>
                      </td>
                      <td>
                        <div className="font-semibold text-slate-800 max-w-md line-clamp-2">
                          {selectedOpt?.title || '(Belum ada judul)'}
                        </div>
                        <div className="text-xs text-muted mt-1">
                          {sub.options?.length || 0} opsi usulan judul diajukan
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={sub.status} />
                      </td>
                      <td>
                        {sub.advisor ? (
                          <div className="advisor-info-stack">
                            <div className="text-xs font-bold text-slate-800">
                              1. {sub.advisor.name}
                            </div>
                            {sub.advisor2 && (
                              <div className="text-xs font-semibold text-slate-600">
                                2. {sub.advisor2.name}
                              </div>
                            )}
                          </div>
                        ) : sub.preferredAdvisor1 || sub.preferredAdvisor2 ? (
                          <div className="text-xs text-blue-700 font-medium">
                            <span>Usulan Mhs:</span>
                            <div>1. {sub.preferredAdvisor1?.name || '-'}</div>
                            {sub.preferredAdvisor2 && <div>2. {sub.preferredAdvisor2.name}</div>}
                          </div>
                        ) : (
                          <span className="text-xs text-muted italic">Belum diplot</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 justify-center">
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

      {/* MODAL TINJAU & PLOTTING DUA DOSEN */}
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
              {/* Usulan Dosen Pembimbing oleh Mahasiswa */}
              {(selectedSub.preferredAdvisor1 || selectedSub.preferredAdvisor2) && (
                <div className="p-3.5 mb-4 rounded-xl bg-blue-50 border border-blue-200 text-xs">
                  <div className="font-bold text-blue-900 mb-1 flex items-center gap-1.5">
                    <Info size={14} />
                    <span>Referensi Calon Dosen Pembimbing Pilihan Mahasiswa:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-blue-800">
                    <div>
                      <strong>Prioritas 1:</strong> {selectedSub.preferredAdvisor1?.name || '(Tidak memilih)'}
                    </div>
                    <div>
                      <strong>Prioritas 2:</strong> {selectedSub.preferredAdvisor2?.name || '(Tidak memilih)'}
                    </div>
                  </div>
                </div>
              )}

              {/* Option Cards Comparison with Tabel Relevansi */}
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

                      {/* Tabel Relevansi Penelitian (Spesifikasi v2.0) */}
                      {(opt.relevance_variable || opt.relevance_methodology || opt.relevance_note) && (
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 mt-2 text-xs">
                          <div className="font-bold text-primary mb-1.5 flex items-center gap-1">
                            <TableProperties size={13} />
                            <span>Tabel Relevansi Penelitian:</span>
                          </div>
                          {opt.relevance_variable && (
                            <div className="mb-1">
                              <span className="text-muted font-semibold">Variabel/Fokus:</span>{' '}
                              <span className="text-slate-800">{opt.relevance_variable}</span>
                            </div>
                          )}
                          {opt.relevance_methodology && (
                            <div className="mb-1">
                              <span className="text-muted font-semibold">Metodologi:</span>{' '}
                              <span className="text-slate-800">{opt.relevance_methodology}</span>
                            </div>
                          )}
                          {opt.relevance_note && (
                            <div>
                              <span className="text-muted font-semibold">Kesesuaian:</span>{' '}
                              <span className="text-slate-800">{opt.relevance_note}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {opt.journal_title ? (
                        <div className="option-section mt-2">
                          <span className="option-label">Jurnal Acuan:</span>
                          <p className="option-journal">
                            <strong>{opt.journal_title}</strong>
                            <br />
                            <span className="text-muted">Penulis: {opt.journal_author}</span>
                          </p>
                        </div>
                      ) : null}

                      {fileUrl && fileUrl !== '#' && (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="file-link-btn mt-2"
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

              {/* Plotting Dua Dosen Pembimbing (Spesifikasi v2.0) */}
              <div className="review-action-section">
                <h4 className="section-subtitle">
                  <User size={16} />
                  <span>Plotting Dua Dosen Pembimbing (Pembimbing 1 & Pembimbing 2)</span>
                </h4>
                <p className="text-xs text-muted mb-3">
                  Tentukan 2 Dosen Pembimbing yang memiliki bidang keahlian relevan untuk mendampingi mahasiswa.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Pembimbing 1 */}
                  <div className="form-group">
                    <label className="text-xs font-bold text-slate-700 uppercase">
                      Dosen Pembimbing 1 (Utama) *
                    </label>
                    <select
                      value={selectedAdvisor1Id}
                      onChange={(e) => setSelectedAdvisor1Id(e.target.value)}
                      className="select-advisor"
                    >
                      <option value="">-- Pilih Pembimbing 1 --</option>
                      {lecturers.map((lec) => {
                        const remaining = Math.max(0, (lec.quota || 10) - (lec.current_students || 0));
                        return (
                          <option key={lec.$id} value={lec.$id}>
                            {lec.name} (Sisa Kuota: {remaining}) - {lec.expertise}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Pembimbing 2 */}
                  <div className="form-group">
                    <label className="text-xs font-bold text-slate-700 uppercase">
                      Dosen Pembimbing 2 (Pendamping)
                    </label>
                    <select
                      value={selectedAdvisor2Id}
                      onChange={(e) => setSelectedAdvisor2Id(e.target.value)}
                      className="select-advisor"
                    >
                      <option value="">-- Pilih Pembimbing 2 (Opsional) --</option>
                      {lecturers
                        .filter((l) => l.$id !== selectedAdvisor1Id)
                        .map((lec) => {
                          const remaining = Math.max(0, (lec.quota || 10) - (lec.current_students || 0));
                          return (
                            <option key={lec.$id} value={lec.$id}>
                              {lec.name} (Sisa Kuota: {remaining}) - {lec.expertise}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700 uppercase">
                    Catatan Verifikasi & Rekomendasi
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Tuliskan catatan kelayakan judul dan arahan awal untuk mahasiswa..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="form-control"
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openDecisionModal('revision')}
                  disabled={actionLoading}
                  className="btn-outline-warning flex items-center gap-1.5"
                >
                  <RotateCcw size={14} />
                  <span>Minta Revisi (3 Judul)</span>
                </button>
                <button
                  type="button"
                  onClick={() => openDecisionModal('rejected')}
                  disabled={actionLoading}
                  className="btn-outline-danger flex items-center gap-1.5"
                >
                  <X size={14} />
                  <span>Tolak Pengajuan</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSub(null)}
                  className="btn-secondary"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSubmitForwardToKaprodi}
                  disabled={actionLoading || !selectedOptionId || !selectedAdvisor1Id}
                  className="btn-primary flex items-center gap-2"
                >
                  <Send size={15} />
                  <span>{actionLoading ? 'Memproses...' : 'Setujui & Teruskan ke Kaprodi'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PENOLAKAN / REVISI TERSTRUKTUR 3 JUDUL (Spesifikasi v2.0 Section 3.B) */}
      {rejectModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title flex items-center gap-2">
                <AlertTriangle
                  size={18}
                  className={rejectModal.type === 'revision' ? 'text-amber-600' : 'text-red-600'}
                />
                <span>
                  {rejectModal.type === 'revision'
                    ? 'Catatan Revisi Terstruktur (3 Opsi Judul)'
                    : 'Catatan Penolakan Terstruktur (3 Opsi Judul)'}
                </span>
              </h3>
              <button onClick={() => setRejectModal(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmDecision}>
              <div className="modal-body space-y-4">
                <div
                  className={`p-3 rounded-lg text-xs leading-relaxed ${
                    rejectModal.type === 'revision'
                      ? 'bg-amber-50 text-amber-900 border border-amber-200'
                      : 'bg-red-50 text-red-900 border border-red-200'
                  }`}
                >
                  {rejectModal.type === 'revision'
                    ? 'Ketiga opsi judul akan ditandai perlu perbaikan. Masukkan catatan evaluasi untuk setiap judul agar mahasiswa dapat melakukan revisi secara transparan.'
                    : 'Pengajuan akan ditolak dan ketiga opsi judul akan ditandai ditolak. Mahasiswa tetap dapat membuat pengajuan baru pasca penolakan.'}
                </div>

                {/* Catatan Judul 1 */}
                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">
                    Catatan untuk Judul #1: &ldquo;{selectedSub?.options?.[0]?.title || 'Opsi 1'}&rdquo; *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Contoh: Perlu revisi pada rumusan masalah dan batasan variabel..."
                    value={rejectModal.noteOpt1}
                    onChange={(e) => setRejectModal({ ...rejectModal, noteOpt1: e.target.value })}
                    className="form-control text-xs"
                  />
                </div>

                {/* Catatan Judul 2 */}
                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">
                    Catatan untuk Judul #2: &ldquo;{selectedSub?.options?.[1]?.title || 'Opsi 2'}&rdquo; *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Contoh: Topik sudah pernah diteliti pada tahun 2024, silakan ganti studi kasus..."
                    value={rejectModal.noteOpt2}
                    onChange={(e) => setRejectModal({ ...rejectModal, noteOpt2: e.target.value })}
                    className="form-control text-xs"
                  />
                </div>

                {/* Catatan Judul 3 */}
                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">
                    Catatan untuk Judul #3: &ldquo;{selectedSub?.options?.[2]?.title || 'Opsi 3'}&rdquo; *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Contoh: Metodologi kurang relevan dengan bidang keahlian prodi..."
                    value={rejectModal.noteOpt3}
                    onChange={(e) => setRejectModal({ ...rejectModal, noteOpt3: e.target.value })}
                    className="form-control text-xs"
                  />
                </div>

                {/* Catatan Tambahan */}
                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">Catatan Tambahan (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Instruksi umum untuk mahasiswa..."
                    value={rejectModal.generalNotes}
                    onChange={(e) => setRejectModal({ ...rejectModal, generalNotes: e.target.value })}
                    className="form-control text-xs"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setRejectModal(null)} className="btn-secondary">
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`btn-sm px-5 py-2 font-bold ${
                    rejectModal.type === 'revision' ? 'btn-warning' : 'btn-danger'
                  }`}
                >
                  {actionLoading
                    ? 'Menyimpan...'
                    : rejectModal.type === 'revision'
                    ? 'Kirimkan Catatan Revisi'
                    : 'Konfirmasi Penolakan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Berkas Lengkap Dossier */}
      {activeDossierSub && (
        <SubmissionDetailModal
          submission={activeDossierSub}
          onClose={() => setActiveDossierSub(null)}
        />
      )}
    </div>
  );
};
