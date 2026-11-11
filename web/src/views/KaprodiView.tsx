import React, { useState, useEffect } from 'react';
import { submissionService } from '../services/submissionService';
import { lecturerService } from '../services/lecturerService';
import { StatusBadge } from '../components/StatusBadge';
import { SubmissionDetailModal } from '../components/SubmissionDetailModal';
import type { ThesisSubmission, Lecturer, ApprovalLog } from '../types';
import {
  Award,
  CheckCircle,
  XCircle,
  Clock,
  User,
  ChevronRight,
  X,
  FileCheck,
  RotateCcw,
  AlertTriangle,
  Eye,
  Send,
  TableProperties,
} from 'lucide-react';

interface Props {
  kaprodiName: string;
}

const LOG_ACTION_LABELS: Record<string, string> = {
  PENGAJUAN_MAHASISWA: 'Pengajuan Mahasiswa',
  VERIFIKASI_DOSEN_PENILAI: 'Verifikasi Dosen Penilai',
  DISAHKAN_KAPRODI: 'Pengesahan Kaprodi',
  MINTA_REVISI: 'Minta Revisi',
  DITOLAK: 'Ditolak',
  UPLOAD_SKRSIPSI: 'Upload File Skripsi',
};

const formatLogNotes = (log: ApprovalLog): string | undefined => {
  if (log.action === 'UPLOAD_SKRSIPSI' && log.notes) {
    try {
      const p = JSON.parse(log.notes);
      if (p.file_name) {
        return `File: ${p.file_name}${p.size ? ` (${(p.size / 1024 / 1024).toFixed(2)} MB)` : ''}`;
      }
    } catch {
      // ignore
    }
  }
  return log.notes;
};

export const KaprodiView: React.FC<Props> = ({ kaprodiName }) => {
  const [submissions, setSubmissions] = useState<ThesisSubmission[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSub, setSelectedSub] = useState<ThesisSubmission | null>(null);
  const [activeDossierSub, setActiveDossierSub] = useState<ThesisSubmission | null>(null);

  // Kaprodi can view and modify BOTH advisors
  const [advisor1Id, setAdvisor1Id] = useState<string>('');
  const [advisor2Id, setAdvisor2Id] = useState<string>('');
  const [kaprodiNotes, setKaprodiNotes] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [filter, setFilter] = useState<'waiting_kaprodi' | 'approved' | 'all'>('waiting_kaprodi');

  // Structured Rejection / Revision modal
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

  const handleOpenDetail = (sub: ThesisSubmission) => {
    setSelectedSub(sub);
    setAdvisor1Id(sub.advisor?.$id || sub.preferredAdvisor1?.$id || '');
    setAdvisor2Id(sub.advisor2?.$id || sub.preferredAdvisor2?.$id || '');
    setKaprodiNotes('');
  };

  // Sahkan SK (Approve)
  const handleApprove = async () => {
    if (!selectedSub) return;
    if (!advisor1Id) {
      showFeedback('Pengajuan ini wajib memiliki Dosen Pembimbing 1 (Utama)!', 'error');
      return;
    }
    if (advisor1Id && advisor2Id && advisor1Id === advisor2Id) {
      showFeedback('Pembimbing 1 dan Pembimbing 2 tidak boleh dosen yang sama!', 'error');
      return;
    }

    setActionLoading(true);
    try {
      await submissionService.kaprodiApprove(
        selectedSub.$id,
        advisor1Id,
        advisor2Id,
        kaprodiName,
        kaprodiNotes
      );
      showFeedback('SK Pengesahan Judul & 2 Dosen Pembimbing resmi disahkan! Status mahasiswa kini Disetujui.');
      setSelectedSub(null);
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal mengesahkan: ${err.message}`, 'error');
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
      generalNotes: kaprodiNotes || '',
    });
  };

  // Submit Structured Decision
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
          kaprodiName,
          rejectModal.noteOpt1,
          rejectModal.noteOpt2,
          rejectModal.noteOpt3,
          rejectModal.generalNotes,
          selectedSub.advisor_id
        );
        showFeedback('Pengajuan dikembalikan untuk revisi. Ketiga opsi memuat catatan perbaikan.');
      } else {
        await submissionService.rejectSubmission(
          selectedSub.$id,
          kaprodiName,
          rejectModal.noteOpt1,
          rejectModal.noteOpt2,
          rejectModal.noteOpt3,
          rejectModal.generalNotes,
          selectedSub.advisor_id
        );
        showFeedback('Pengajuan resmi ditolak oleh Kaprodi.');
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
  const waitingCount = submissions.filter((s) => s.status === 'waiting_kaprodi').length;
  const approvedCount = submissions.filter((s) => s.status === 'approved').length;
  const totalVerified = submissionService.calculateTotalVerified(submissions);

  const filteredSubmissions = submissions.filter((s) => {
    if (filter === 'all') return true;
    return s.status === filter;
  });

  const chosenOption =
    selectedSub?.options?.find((o) => o.is_selected_by_lecturer) ||
    selectedSub?.options?.[0];

  return (
    <div className="kaprodi-container">
      {/* Toast Feedback */}
      {feedback && (
        <div className={`feedback-toast ${feedback.type}`}>
          <CheckCircle size={18} />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="page-title">Panel Pengesahan Final (Ketua Program Studi)</h1>
          <p className="page-desc">
            Pengesahan SK Penetapan Judul Skripsi dan validasi akhir penugasan 2 Dosen Pembimbing.
          </p>
        </div>
      </div>

      {/* Stat Metric Bar */}
      <div className="stat-metric-bar">
        <div className="metric-card">
          <div className="metric-icon-circle" style={{ backgroundColor: '#EFF6FF', color: '#0A4C8F' }}>
            <Clock size={20} />
          </div>
          <div>
            <div className="metric-val">{waitingCount}</div>
            <div className="metric-label">Menunggu Pengesahan SK</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
            <Award size={20} />
          </div>
          <div>
            <div className="metric-val">{totalVerified}</div>
            <div className="metric-label">Total Proposal Sah Masuk</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="metric-val">{approvedCount}</div>
            <div className="metric-label">Resmi Diterbitkan SK</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-pill-bar">
        <button
          onClick={() => setFilter('waiting_kaprodi')}
          className={`filter-pill ${filter === 'waiting_kaprodi' ? 'active' : ''}`}
        >
          <span>Menunggu Validasi</span>
          <span className="filter-pill-badge">{waitingCount}</span>
        </button>
        <button
          onClick={() => setFilter('approved')}
          className={`filter-pill ${filter === 'approved' ? 'active' : ''}`}
        >
          <span>Telah Disahkan</span>
          <span className="filter-pill-badge">{approvedCount}</span>
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
        >
          <span>Semua Pengajuan</span>
          <span className="filter-pill-badge">{submissions.length}</span>
        </button>
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Mahasiswa & NIM</th>
                <th>Prodi & Letting</th>
                <th>Judul Terpilih</th>
                <th>Status</th>
                <th>Dosen Pembimbing 1 & 2</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted">
                    {loading ? 'Memuat berkas...' : 'Tidak ada berkas pengajuan pada filter ini.'}
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => {
                  const chosen =
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
                          {chosen?.title || '(Belum ada judul)'}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={sub.status} />
                        {sub.status === 'approved' && sub.nomor_surat && (
                          <div className="mt-1 font-mono text-[10px] text-emerald-700 font-bold">
                            {sub.nomor_surat}
                          </div>
                        )}
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
                            onClick={() => handleOpenDetail(sub)}
                            className={`btn-sm ${sub.status === 'approved' ? 'btn-outline-primary' : 'btn-primary'}`}
                          >
                            <span>{sub.status === 'approved' ? 'Lihat SK' : 'Validasi SK'}</span>
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

      {/* MODAL PENGESAHAN KAPRODI */}
      {selectedSub && (
        <div className="modal-backdrop">
          <div className="modal-card modal-large">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Lembar Pengesahan SK Judul Skripsi</h3>
                <p className="text-xs text-muted">
                  No. Pengajuan: SPSM-{selectedSub.$id.toUpperCase()}
                </p>
              </div>
              <button onClick={() => setSelectedSub(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body space-y-4">
              {/* Summary Banner */}
              <div className="summary-banner">
                <div className="summary-item">
                  <span className="summary-label">Nama Mahasiswa</span>
                  <span className="summary-val">{selectedSub.student?.name || '-'}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">NIM</span>
                  <span className="summary-val font-mono">
                    {selectedSub.student?.nim_or_nip || selectedSub.student_id}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Program Studi</span>
                  <span className="summary-val">{selectedSub.student?.department || '-'}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Angkatan (Letting)</span>
                  <span className="summary-val">{selectedSub.student?.batch_year || '-'}</span>
                </div>
              </div>

              {/* Chosen Title Box with Tabel Relevansi */}
              <div className="chosen-title-box">
                <div className="flex items-center gap-2 mb-2">
                  <span className="badge badge-success">
                    <FileCheck size={14} />
                    <span>Judul Terpilih (Opsi {chosenOption?.option_number})</span>
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-2">{chosenOption?.title}</h3>
                <div className="text-xs text-slate-600 mb-3">
                  <strong>Latar Belakang:</strong>
                  <p className="mt-1 leading-relaxed">{chosenOption?.background}</p>
                </div>

                {/* Tabel Relevansi */}
                {(chosenOption?.relevance_variable ||
                  chosenOption?.relevance_methodology ||
                  chosenOption?.relevance_note) && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs mb-2">
                    <div className="font-bold text-blue-900 mb-1 flex items-center gap-1.5">
                      <TableProperties size={13} />
                      <span>Tabel Relevansi Penelitian:</span>
                    </div>
                    {chosenOption.relevance_variable && (
                      <div>
                        <strong>Variabel:</strong> {chosenOption.relevance_variable}
                      </div>
                    )}
                    {chosenOption.relevance_methodology && (
                      <div>
                        <strong>Metodologi:</strong> {chosenOption.relevance_methodology}
                      </div>
                    )}
                    {chosenOption.relevance_note && (
                      <div>
                        <strong>Kesesuaian:</strong> {chosenOption.relevance_note}
                      </div>
                    )}
                  </div>
                )}

                {chosenOption?.journal_title ? (
                  <div className="text-xs text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200">
                    <strong>Jurnal Acuan:</strong> {chosenOption.journal_title}{' '}
                    {chosenOption.journal_author ? `(Oleh: ${chosenOption.journal_author})` : ''}
                  </div>
                ) : null}
              </div>

              {/* Kaprodi Advisor Authority: Kaprodi can view & modify BOTH advisors (Spesifikasi v2.0 Section 3.A) */}
              <div className="advisor-assignment-card p-4 rounded-xl border border-slate-200 bg-slate-50">
                <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-1 text-sm">
                  <User size={16} color="#0A4C8F" />
                  <span>Validasi & Pengaturan Dua Dosen Pembimbing (Hak Akses Kaprodi)</span>
                </h4>
                <p className="text-xs text-muted mb-3">
                  Kaprodi memiliki hak penuh untuk mengesahkan atau mengubah kedua Dosen Pembimbing sebelum menerbitkan SK.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Pembimbing 1 */}
                  <div className="form-group">
                    <label className="text-xs font-bold text-slate-700 uppercase">
                      Dosen Pembimbing 1 (Utama) *
                    </label>
                    <select
                      disabled={selectedSub.status !== 'waiting_kaprodi'}
                      value={advisor1Id}
                      onChange={(e) => setAdvisor1Id(e.target.value)}
                      className="select-advisor"
                    >
                      <option value="">-- Pilih Pembimbing 1 --</option>
                      {lecturers.map((lec) => {
                        const remaining = Math.max(0, (lec.quota || 10) - (lec.current_students || 0));
                        return (
                          <option key={lec.$id} value={lec.$id}>
                            {lec.name} (Sisa Kuota: {remaining})
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
                      disabled={selectedSub.status !== 'waiting_kaprodi'}
                      value={advisor2Id}
                      onChange={(e) => setAdvisor2Id(e.target.value)}
                      className="select-advisor"
                    >
                      <option value="">-- Pilih Pembimbing 2 (Opsional) --</option>
                      {lecturers
                        .filter((l) => l.$id !== advisor1Id)
                        .map((lec) => {
                          const remaining = Math.max(0, (lec.quota || 10) - (lec.current_students || 0));
                          return (
                            <option key={lec.$id} value={lec.$id}>
                              {lec.name} (Sisa Kuota: {remaining})
                            </option>
                          );
                        })}
                    </select>
                  </div>
                </div>
              </div>

              {/* Reviewer Logs & History */}
              {selectedSub.logs && selectedSub.logs.length > 0 && (
                <div className="logs-history-section">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Catatan Tim Reviewer Sebelumnya:
                  </h4>
                  {selectedSub.logs.map((log) => (
                    <div key={log.$id} className="log-item">
                      <div className="log-header">
                        <span className="log-actor">{log.actor_id}</span>
                        <span className="log-date">
                          {new Date(log.created_at).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="log-action-badge">
                        {LOG_ACTION_LABELS[log.action] || log.action}
                      </div>
                      {formatLogNotes(log) && (
                        <p className="log-notes text-xs">{formatLogNotes(log)}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Kaprodi Decision Notes */}
              {selectedSub.status === 'waiting_kaprodi' ? (
                <div className="form-group mt-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">
                    Catatan SK Pengesahan Kaprodi (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Disetujui dan disahkan. Mahasiswa dapat segera memulai proses bimbingan..."
                    value={kaprodiNotes}
                    onChange={(e) => setKaprodiNotes(e.target.value)}
                    className="form-control text-xs"
                  />
                </div>
              ) : selectedSub.status === 'approved' ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle size={20} color="#059669" />
                    <div className="text-xs text-emerald-800">
                      <strong>Telah Resmi Disahkan:</strong> Surat Keputusan penetapan judul dan 2 Dosen Pembimbing telah diterbitkan.
                      {selectedSub.nomor_surat && (
                        <div className="mt-1 font-mono font-bold text-emerald-950">
                          Nomor SK: {selectedSub.nomor_surat} {selectedSub.urutan_surat ? `(Urutan #${selectedSub.urutan_surat})` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : selectedSub.status === 'rejected' ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3">
                  <XCircle size={20} color="#E11D48" />
                  <div className="text-xs text-rose-800">
                    <strong>Status Ditolak:</strong> Pengajuan ini telah berstatus ditolak.
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                  <Clock size={20} color="#D97706" />
                  <div className="text-xs text-amber-800">
                    <strong>Status Revisi:</strong> Pengajuan sedang menunggu perbaikan usulan dari mahasiswa.
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer justify-between">
              {selectedSub.status === 'waiting_kaprodi' ? (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => openDecisionModal('revision')}
                      className="btn-outline-warning flex items-center gap-1.5"
                    >
                      <RotateCcw size={14} />
                      <span>Kembalikan untuk Revisi</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => openDecisionModal('rejected')}
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
                      disabled={actionLoading || !advisor1Id}
                      onClick={handleApprove}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Send size={15} />
                      <span>{actionLoading ? 'Menerbitkan SK...' : 'Sahkan SK & Tetapkan Pembimbing'}</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedSub(null)}
                    className="btn-secondary"
                  >
                    Tutup
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL REVISI / PENOLAKAN TERSTRUKTUR KAPRODI */}
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
                    ? 'Catatan Pengembalian Revisi (3 Judul)'
                    : 'Catatan Penolakan Pengajuan (3 Judul)'}
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
                    ? 'Ketiga opsi judul akan ditandai perlu perbaikan oleh Kaprodi.'
                    : 'Pengajuan akan ditolak oleh Kaprodi dan mahasiswa dapat mengajukan kembali proposal baru.'}
                </div>

                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">
                    Catatan Judul #1: &ldquo;{selectedSub?.options?.[0]?.title || 'Opsi 1'}&rdquo; *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Instruksi perbaikan judul #1..."
                    value={rejectModal.noteOpt1}
                    onChange={(e) => setRejectModal({ ...rejectModal, noteOpt1: e.target.value })}
                    className="form-control text-xs"
                  />
                </div>

                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">
                    Catatan Judul #2: &ldquo;{selectedSub?.options?.[1]?.title || 'Opsi 2'}&rdquo; *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Instruksi perbaikan judul #2..."
                    value={rejectModal.noteOpt2}
                    onChange={(e) => setRejectModal({ ...rejectModal, noteOpt2: e.target.value })}
                    className="form-control text-xs"
                  />
                </div>

                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">
                    Catatan Judul #3: &ldquo;{selectedSub?.options?.[2]?.title || 'Opsi 3'}&rdquo; *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Instruksi perbaikan judul #3..."
                    value={rejectModal.noteOpt3}
                    onChange={(e) => setRejectModal({ ...rejectModal, noteOpt3: e.target.value })}
                    className="form-control text-xs"
                  />
                </div>

                <div className="form-group">
                  <label className="text-xs font-bold text-slate-700">Catatan Tambahan (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Instruksi umum dari Kaprodi..."
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
                    ? 'Kirimkan Revisi'
                    : 'Konfirmasi Tolak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dossier Berkas Lengkap */}
      {activeDossierSub && (
        <SubmissionDetailModal
          submission={activeDossierSub}
          onClose={() => setActiveDossierSub(null)}
        />
      )}
    </div>
  );
};
