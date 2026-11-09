import React, { useState, useEffect } from 'react';
import { submissionService } from '../services/submissionService';
import { lecturerService } from '../services/lecturerService';
import { StatusBadge } from '../components/StatusBadge';
import { SubmissionDetailModal } from '../components/SubmissionDetailModal';
import type { ThesisSubmission, Lecturer } from '../types';
import {
  UserCheck,
  BookOpen,
  GraduationCap,
  Calendar,
  Users,
  ExternalLink,
  Award,
  Layers,
  FileText,
  Search,
  CheckCircle2,
  AlertCircle,
  Eye,
} from 'lucide-react';

interface Props {
  advisorName: string;
  currentLecturerId?: string;
  isAdmin: boolean;
}

export const AdvisorView: React.FC<Props> = ({
  advisorName,
  currentLecturerId,
  isAdmin,
}) => {
  const [submissions, setSubmissions] = useState<ThesisSubmission[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>(
    !isAdmin && currentLecturerId ? currentLecturerId : 'all'
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeDossierSub, setActiveDossierSub] = useState<ThesisSubmission | null>(null);

  useEffect(() => {
    // If not admin and lecturer ID changes, force lock
    if (!isAdmin && currentLecturerId) {
      setSelectedLecturerId(currentLecturerId);
    }
  }, [isAdmin, currentLecturerId]);

  useEffect(() => {
    loadData();
  }, [selectedLecturerId, currentLecturerId, isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      // If not admin, strictly fetch data for the logged-in lecturer only
      const targetAdvisorId = (!isAdmin && currentLecturerId)
        ? currentLecturerId
        : selectedLecturerId !== 'all'
        ? selectedLecturerId
        : undefined;

      const [subs, lecs] = await Promise.all([
        submissionService.getAllSubmissions('approved', targetAdvisorId),
        lecturerService.getLecturers(),
      ]);

      setSubmissions(subs);
      setLecturers(lecs);

      // Auto-sync active quota for current lecturer if available
      if (currentLecturerId) {
        await lecturerService.syncStudentCount(currentLecturerId);
      }
    } catch (err) {
      console.error('Failed to load advisor data:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentLecData = lecturers.find(
    (l) => l.$id === (isAdmin ? selectedLecturerId : currentLecturerId)
  );

  // Filter based on search query
  const filteredSubs = submissions.filter((s) => {
    // Role isolation check: non-admin can NEVER see other lecturers' students
    if (!isAdmin && currentLecturerId && s.advisor_id !== currentLecturerId) {
      return false;
    }

    if (selectedLecturerId !== 'all' && s.advisor_id !== selectedLecturerId) {
      return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const studentName = s.student?.name?.toLowerCase() || '';
    const studentNim = s.student?.nim_or_nip?.toLowerCase() || '';
    const chosenTitle =
      s.options?.find((o) => o.is_selected_by_lecturer)?.title?.toLowerCase() ||
      s.options?.[0]?.title?.toLowerCase() ||
      '';
    return (
      studentName.includes(q) ||
      studentNim.includes(q) ||
      chosenTitle.includes(q)
    );
  });

  return (
    <div className="advisor-container">
      {/* Page Header */}
      <div className="section-header">
        <div>
          <h1 className="page-title">
            {!isAdmin ? `Bimbingan Skripsi — ${advisorName}` : 'Monitoring Dosen Pembimbing'}
          </h1>
          <p className="page-desc">
            {!isAdmin
              ? 'Daftar mahasiswa skripsi yang berada di bawah bimbingan resmi Anda setelah disahkan Kaprodi.'
              : 'Daftar seluruh mahasiswa yang judul skripsinya telah disahkan dan diplot ke masing-masing Dosen Pembimbing.'}
          </p>
        </div>

        {/* Filter Lecturer for Admin */}
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">Pilih Dosen:</label>
              <select
                value={selectedLecturerId}
                onChange={(e) => setSelectedLecturerId(e.target.value)}
                className="filter-select"
              >
                <option value="all">Semua Dosen Pembimbing ({submissions.length} bimbingan)</option>
                {lecturers.map((lec) => (
                  <option key={lec.$id} value={lec.$id}>
                    {lec.name} ({lec.current_students || 0}/{lec.quota} mhs)
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="advisor-badge-personal">
              <UserCheck size={16} color="#059669" />
              <span>Data Terisolasi: Khusus Bimbingan Anda</span>
            </div>
          )}
        </div>
      </div>

      {/* Lecturer Quota & Workload Banner */}
      {currentLecData && (
        <div className="workload-summary-banner">
          <div className="workload-info-col">
            <div className="workload-header-row">
              <Award size={20} color="#0A4C8F" />
              <h2 className="workload-name">{currentLecData.name}</h2>
              <span className="workload-nip">NIP: {currentLecData.nip}</span>
            </div>
            <p className="workload-expertise">
              Bidang Keahlian: <strong>{currentLecData.expertise || 'Ilmu Komputer & Rekayasa Perangkat Lunak'}</strong>
            </p>
          </div>

          <div className="workload-stats-row">
            <div className="workload-stat-box">
              <span className="stat-label">Beban Bimbingan Aktif</span>
              <span className="stat-val font-bold text-primary">
                {currentLecData.current_students || filteredSubs.length} Mahasiswa
              </span>
            </div>
            <div className="workload-stat-box">
              <span className="stat-label">Batas Kuota Maksimal</span>
              <span className="stat-val font-bold text-slate-700">
                {currentLecData.quota} Mahasiswa
              </span>
            </div>
            <div className="workload-stat-box">
              <span className="stat-label">Sisa Kuota Tersedia</span>
              <span
                className={`stat-val font-bold ${
                  currentLecData.quota - (currentLecData.current_students || filteredSubs.length) <= 2
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {Math.max(
                  0,
                  currentLecData.quota - (currentLecData.current_students || filteredSubs.length)
                )}{' '}
                Slot
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Search & Actions Bar */}
      <div className="advisor-search-bar">
        <div className="search-input-wrap">
          <Search size={16} color="#64748B" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama mahasiswa, NIM, atau judul skripsi..."
            className="search-input"
          />
        </div>
        <div className="total-badge">
          <span>Menampilkan {filteredSubs.length} Mahasiswa</span>
        </div>
      </div>

      {/* Grid of Supervised Students */}
      {loading ? (
        <div className="loading-state-box">
          <div className="spinner" />
          <p>Memuat daftar mahasiswa bimbingan...</p>
        </div>
      ) : filteredSubs.length === 0 ? (
        <div className="empty-box col-span-full">
          <Users size={40} color="#94A3B8" />
          <h4 className="text-slate-700 font-bold mt-3 text-base">
            {!isAdmin
              ? 'Belum Ada Mahasiswa Bimbingan'
              : 'Tidak Ada Mahasiswa Ditemukan'}
          </h4>
          <p className="text-xs text-muted max-w-md text-center mt-1">
            {!isAdmin
              ? 'Ketika Dosen Penilai memilih Anda sebagai Dosen Pembimbing dan pengajuan telah disahkan oleh Kaprodi, data mahasiswa akan otomatis muncul di sini.'
              : 'Tidak ada mahasiswa bimbingan yang sesuai dengan filter yang dipilih.'}
          </p>
        </div>
      ) : (
        <div className="supervised-grid mt-6">
          {filteredSubs.map((sub) => {
            const chosen =
              sub.options?.find((o) => o.is_selected_by_lecturer) || sub.options?.[0];
            const fileUrl = chosen?.journal_file_id
              ? submissionService.getFileViewUrl(chosen.journal_file_id)
              : null;

            return (
              <div key={sub.$id} className="student-card formal-student-card">
                <div className="student-card-header">
                  <div>
                    <div className="font-bold text-slate-800 text-base">
                      {sub.student?.name || 'Mahasiswa'}
                    </div>
                    <div className="text-xs text-muted font-mono mt-0.5">
                      NIM: {sub.student?.nim_or_nip || sub.student_id} • {sub.student?.department} (
                      {sub.student?.batch_year})
                    </div>
                  </div>
                  <StatusBadge status={sub.status} size="sm" />
                </div>

                <div className="student-thesis-box">
                  <div className="text-xs font-semibold text-primary mb-1 flex items-center gap-1.5">
                    <BookOpen size={14} />
                    <span>Judul Skripsi Disahkan:</span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm leading-snug">
                    {chosen?.title || 'Judul Skripsi'}
                  </h4>
                  <p className="text-xs text-slate-600 mt-2 line-clamp-3 leading-relaxed">
                    {chosen?.background}
                  </p>
                </div>

                <div className="student-advisor-footer">
                  <div className="advisor-pill">
                    <GraduationCap size={15} color="#0A4C8F" />
                    <span>Pembimbing: {sub.advisor?.name || advisorName}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {fileUrl && fileUrl !== '#' && (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-outline-pdf"
                        title="Lihat Jurnal PDF"
                      >
                        <FileText size={13} />
                        <span>PDF</span>
                        <ExternalLink size={11} />
                      </a>
                    )}
                    <button
                      onClick={() => setActiveDossierSub(sub)}
                      className="btn-view-dossier"
                    >
                      <Eye size={13} />
                      <span>Detail Berkas</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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
