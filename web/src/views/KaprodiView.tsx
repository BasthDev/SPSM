import React, { useState, useEffect } from 'react';
import { submissionService } from '../services/submissionService';
import { StatusBadge } from '../components/StatusBadge';
import { SubmissionDetailModal } from '../components/SubmissionDetailModal';
import type { ThesisSubmission } from '../types';
import {
  Award,
  CheckCircle,
  XCircle,
  Clock,
  User,
  BookOpen,
  ChevronRight,
  X,
  FileCheck,
  AlertCircle,
  MessageSquare,
  Eye,
} from 'lucide-react';

interface Props {
  kaprodiName: string;
}

export const KaprodiView: React.FC<Props> = ({ kaprodiName }) => {
  const [submissions, setSubmissions] = useState<ThesisSubmission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSub, setSelectedSub] = useState<ThesisSubmission | null>(null);
  const [activeDossierSub, setActiveDossierSub] = useState<ThesisSubmission | null>(null);
  const [kaprodiNotes, setKaprodiNotes] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [filter, setFilter] = useState<'waiting_kaprodi' | 'approved' | 'all'>('waiting_kaprodi');

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
      const subs = await submissionService.getAllSubmissions();
      setSubmissions(subs);
    } catch (err: any) {
      showFeedback(`Gagal memuat data: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = (sub: ThesisSubmission) => {
    setSelectedSub(sub);
    setKaprodiNotes('');
  };

  // Sahkan (Approve)
  const handleApprove = async () => {
    if (!selectedSub) return;
    if (!selectedSub.advisor_id) {
      showFeedback('Pengajuan ini belum memiliki Dosen Pembimbing!', 'error');
      return;
    }

    setActionLoading(true);
    try {
      await submissionService.kaprodiApprove(
        selectedSub.$id,
        selectedSub.advisor_id,
        kaprodiName,
        kaprodiNotes
      );
      showFeedback('Judul dan Dosen Pembimbing berhasil disahkan! Status mahasiswa kini "Disetujui".');
      setSelectedSub(null);
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal mengesahkan: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject
  const handleReject = async () => {
    if (!selectedSub) return;
    if (!confirm('Apakah Anda yakin ingin menolak pengajuan ini?')) return;

    setActionLoading(true);
    try {
      await submissionService.rejectSubmission(selectedSub.$id, kaprodiName, kaprodiNotes);
      showFeedback('Pengajuan telah ditolak.');
      setSelectedSub(null);
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Revision
  const handleRevision = async () => {
    if (!selectedSub) return;
    if (!kaprodiNotes) {
      showFeedback('Tuliskan catatan perbaikan untuk mahasiswa!', 'error');
      return;
    }

    setActionLoading(true);
    try {
      await submissionService.requestRevision(selectedSub.$id, kaprodiName, kaprodiNotes);
      showFeedback('Pengajuan dikembalikan untuk revisi.');
      setSelectedSub(null);
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const waitingCount = submissions.filter((s) => s.status === 'waiting_kaprodi').length;
  const approvedCount = submissions.filter((s) => s.status === 'approved').length;

  const filteredSubmissions = submissions.filter((s) => {
    if (filter === 'all') return true;
    return s.status === filter;
  });

  return (
    <div className="kaprodi-container">
      {/* Toast Feedback */}
      {feedback && (
        <div className={`feedback-toast ${feedback.type}`}>
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="page-title">Panel Pengesahan Ketua Program Studi (Kaprodi)</h1>
          <p className="page-desc">
            Validasi akhir usulan judul skripsi dan penetapan Dosen Pembimbing yang telah diverifikasi oleh tim penilai.
          </p>
        </div>

        <div className="tab-pill-group">
          <button
            onClick={() => setFilter('waiting_kaprodi')}
            className={`tab-pill-btn ${filter === 'waiting_kaprodi' ? 'active' : ''}`}
          >
            <Clock size={16} />
            <span>Perlu Pengesahan ({waitingCount})</span>
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`tab-pill-btn ${filter === 'approved' ? 'active' : ''}`}
          >
            <CheckCircle size={16} />
            <span>Telah Disahkan ({approvedCount})</span>
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`tab-pill-btn ${filter === 'all' ? 'active' : ''}`}
          >
            <span>Semua Data ({submissions.length})</span>
          </button>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="card mt-6">
        <div className="card-top-action">
          <h3 className="card-subhead">
            {filter === 'waiting_kaprodi'
              ? 'Daftar Pengajuan Menunggu Tanda Tangan / Pengesahan Kaprodi'
              : 'Daftar Seluruh Pengajuan'}
          </h3>
        </div>

        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Mahasiswa</th>
                <th>Jurusan & Angkatan</th>
                <th>Judul Yang Dipilih Reviewer</th>
                <th>Calon Pembimbing</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted">
                    Tidak ada antrean pengajuan pada kategori ini.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => {
                  const student = sub.student;
                  const chosenOption =
                    sub.options?.find((o) => o.is_selected_by_lecturer) || sub.options?.[0];

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
                      <td className="max-w-md">
                        {chosenOption ? (
                          <div>
                            <span className="badge badge-success-outline mr-1">
                              Opsi {chosenOption.option_number}
                            </span>
                            <span className="font-medium text-slate-800">{chosenOption.title}</span>
                          </div>
                        ) : (
                          <span className="text-muted italic">Belum ada judul dipilih</span>
                        )}
                      </td>
                      <td>
                        {sub.advisor ? (
                          <div>
                            <div className="font-semibold text-primary">{sub.advisor.name}</div>
                            <div className="text-xs text-muted font-mono">NIP: {sub.advisor.nip}</div>
                          </div>
                        ) : (
                          <span className="text-muted italic">Belum ditentukan</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={sub.status} size="sm" />
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
                            onClick={() => handleOpenDetail(sub)}
                            className="btn-sm btn-primary"
                          >
                            <span>Validasi</span>
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
                <h3 className="modal-title">Lembar Pengesahan Judul Skripsi</h3>
                <p className="text-xs text-muted">
                  No. Pengajuan: {selectedSub.$id} | Tanggal:{' '}
                  {new Date(
                    selectedSub.submitted_at || selectedSub.$createdAt || Date.now()
                  ).toLocaleDateString('id-ID')}
                </p>
              </div>
              <button onClick={() => setSelectedSub(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Mahasiswa Info Card */}
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

              {/* Chosen Title Box */}
              {(() => {
                const chosen =
                  selectedSub.options?.find((o) => o.is_selected_by_lecturer) ||
                  selectedSub.options?.[0];
                return (
                  <div className="chosen-title-box">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="badge badge-success">
                        <FileCheck size={14} />
                        <span>Judul Terpilih (Opsi {chosen?.option_number})</span>
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">{chosen?.title}</h3>
                    <div className="text-sm text-slate-600 mb-3">
                      <strong>Latar Belakang:</strong>
                      <p className="mt-1">{chosen?.background}</p>
                    </div>
                    <div className="text-xs text-slate-500 bg-white p-3 rounded-lg border border-slate-200">
                      <strong>Jurnal Acuan:</strong> {chosen?.journal_title} (Oleh: {chosen?.journal_author})
                    </div>
                  </div>
                );
              })()}

              {/* Advisor Assignment Box */}
              <div className="advisor-assignment-card">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2 mb-2">
                  <User size={16} color="#0A4C8F" />
                  <span>Dosen Pembimbing yang Diusulkan:</span>
                </h4>
                {selectedSub.advisor ? (
                  <div className="advisor-box">
                    <div className="advisor-avatar">
                      {selectedSub.advisor.name.charAt(0)}
                    </div>
                    <div className="advisor-details">
                      <div className="font-bold text-slate-800">{selectedSub.advisor.name}</div>
                      <div className="text-xs text-muted font-mono">
                        NIP: {selectedSub.advisor.nip} | Prodi: {selectedSub.advisor.department_id}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        Keahlian: <strong>{selectedSub.advisor.expertise}</strong>
                      </div>
                      <div className="text-xs text-primary font-semibold mt-1">
                        Kuota Saat Ini: {selectedSub.advisor.current_students || 0} /{' '}
                        {selectedSub.advisor.quota} mahasiswa
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-amber-600 text-sm">
                    ⚠️ Belum ada dosen pembimbing yang dipilih untuk pengajuan ini.
                  </div>
                )}
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
                      <div className="log-action-badge">{log.action}</div>
                      {log.notes && <p className="log-notes">{log.notes}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Kaprodi Decision Notes */}
              <div className="form-group mt-4">
                <label>Catatan Pengesahan Kaprodi (Opsional)</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Disetujui dan disahkan. Mahasiswa dapat segera memulai bimbingan Bab 1."
                  value={kaprodiNotes}
                  onChange={(e) => setKaprodiNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer justify-between">
              <div className="footer-left-buttons">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleRevision}
                  className="btn btn-warning"
                >
                  Kembalikan untuk Revisi
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleReject}
                  className="btn btn-danger-outline"
                >
                  Tolak
                </button>
              </div>

              <div className="footer-right-buttons">
                <button
                  type="button"
                  onClick={() => setSelectedSub(null)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={actionLoading || selectedSub.status === 'approved'}
                  onClick={handleApprove}
                  className="btn btn-success"
                >
                  <CheckCircle size={16} />
                  <span>
                    {selectedSub.status === 'approved'
                      ? 'Sudah Disahkan'
                      : actionLoading
                      ? 'Memproses...'
                      : 'Sahkan Judul & Dosen'}
                  </span>
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
