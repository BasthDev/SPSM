import React, { useState, useEffect } from 'react';
import { submissionService } from '../services/submissionService';
import { lecturerService } from '../services/lecturerService';
import { StatusBadge } from '../components/StatusBadge';
import { SubmissionDetailModal } from '../components/SubmissionDetailModal';
import type { ThesisSubmission, Lecturer } from '../types';
import {
  Users,
  BookOpen,
  GraduationCap,
  Calendar,
  ExternalLink,
  Award,
  FileText,
  Search,
  CheckCircle,
  Eye,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  UserCheck,
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
  const [activeTab, setActiveTab] = useState<'students' | 'profile'>('students');
  const [submissions, setSubmissions] = useState<ThesisSubmission[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>(
    !isAdmin && currentLecturerId ? currentLecturerId : 'all'
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeDossierSub, setActiveDossierSub] = useState<ThesisSubmission | null>(null);

  useEffect(() => {
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
      const targetAdvisorId =
        !isAdmin && currentLecturerId
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

  // Filter based on search query and lecturer isolation
  const filteredSubs = submissions.filter((s) => {
    const advisorParts = (s.advisor_id || '').split(',').map((p) => p.trim());
    // Role isolation: lecturer CANNOT see others
    if (!isAdmin && currentLecturerId && !advisorParts.includes(currentLecturerId)) {
      return false;
    }

    if (selectedLecturerId !== 'all' && !advisorParts.includes(selectedLecturerId)) {
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

  const activeCount = filteredSubs.length;
  const maxQuota = currentLecData?.quota || 10;
  const remainingQuota = Math.max(0, maxQuota - activeCount);

  return (
    <div className="admin-container">
      {/* Header Bar matching AdminView */}
      <div className="section-header">
        <div>
          <h1 className="page-title">
            {!isAdmin ? `Portal Dosen Pembimbing — ${advisorName}` : 'Monitoring Dosen Pembimbing'}
          </h1>
          <p className="page-desc">
            {!isAdmin
              ? 'Daftar resmi mahasiswa skripsi yang berada di bawah bimbingan Anda setelah disahkan Kaprodi.'
              : 'Daftar seluruh mahasiswa skripsi yang telah disahkan dan diplot ke masing-masing Dosen Pembimbing.'}
          </p>
        </div>

        {/* Tab Buttons matching AdminView */}
        <div className="tab-pill-group">
          <button
            onClick={() => setActiveTab('students')}
            className={`tab-pill-btn ${activeTab === 'students' ? 'active' : ''}`}
          >
            <Users size={16} />
            <span>Mahasiswa Bimbingan ({activeCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`tab-pill-btn ${activeTab === 'profile' ? 'active' : ''}`}
          >
            <Award size={16} />
            <span>Profil & Beban Kuota</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards matching AdminView style */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon info">
            <Users size={20} />
          </div>
          <div>
            <div className="stat-number">{activeCount}</div>
            <div className="stat-label">Mahasiswa Bimbingan Aktif</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon success">
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="stat-number">{maxQuota}</div>
            <div className="stat-label">Batas Kuota Bimbingan</div>
          </div>
        </div>

        <div className="stat-card">
          <div className={`stat-icon ${remainingQuota <= 2 ? 'warning' : 'primary'}`}>
            <Award size={20} />
          </div>
          <div>
            <div className="stat-number">{remainingQuota}</div>
            <div className="stat-label">Sisa Kuota Tersedia</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon primary">
            <Building2 size={20} />
          </div>
          <div>
            <div className="stat-number">{currentLecData?.department_id || 'TI'}</div>
            <div className="stat-label">Program Studi Naungan</div>
          </div>
        </div>
      </div>

      {/* TAB 1: MAHASISWA BIMBINGAN */}
      {activeTab === 'students' && (
        <div className="card tab-content mt-6">
          <div className="card-top-action">
            <div>
              <h3 className="card-subhead">Daftar Mahasiswa Bimbingan Skripsi</h3>
              <p className="card-subdesc">
                Data mahasiswa skripsi aktif yang telah divalidasi oleh Penilai dan disahkan resmi oleh Ketua Program Studi.
              </p>
            </div>

            {/* Filter Dosen (for Admin only) */}
            {isAdmin && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">Pilih Dosen:</label>
                <select
                  value={selectedLecturerId}
                  onChange={(e) => setSelectedLecturerId(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">Semua Dosen Pembimbing</option>
                  {lecturers.map((lec) => (
                    <option key={lec.$id} value={lec.$id}>
                      {lec.name} ({lec.current_students || 0}/{lec.quota} mhs)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Search bar matching AdminView */}
          <div className="filter-bar">
            <div className="search-box">
              <Search size={16} color="#64748B" />
              <input
                type="text"
                placeholder="Cari mahasiswa, NIM, atau judul skripsi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <span className="text-xs text-muted font-medium">
                Total Bimbingan: <strong>{filteredSubs.length}</strong> mahasiswa
              </span>
            </div>
          </div>

          {/* Table matching AdminView structure */}
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Mahasiswa</th>
                  <th>NIM & Angkatan</th>
                  <th>Judul Skripsi Disahkan</th>
                  <th>Tanggal Pengesahan</th>
                  <th>Status</th>
                  <th>Jurnal Acuan</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted">
                      Memuat daftar mahasiswa bimbingan...
                    </td>
                  </tr>
                ) : filteredSubs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted">
                      {!isAdmin
                        ? 'Belum ada mahasiswa bimbingan skripsi yang disahkan.'
                        : 'Tidak ada mahasiswa bimbingan ditemukan dengan filter ini.'}
                    </td>
                  </tr>
                ) : (
                  filteredSubs.map((sub) => {
                    const student = sub.student;
                    const chosenOption =
                      sub.options?.find((o) => o.is_selected_by_lecturer) || sub.options?.[0];
                    const fileUrl = chosenOption?.journal_file_id
                      ? submissionService.getFileViewUrl(chosenOption.journal_file_id)
                      : null;

                    return (
                      <tr key={sub.$id}>
                        <td>
                          <div className="font-semibold text-slate-800">
                            {student?.name || 'Mahasiswa'}
                          </div>
                          <div className="text-xs text-muted">
                            {student?.email || '-'}
                          </div>
                        </td>
                        <td>
                          <div className="font-mono font-medium text-slate-700">
                            {student?.nim_or_nip || sub.student_id}
                          </div>
                          <div className="text-xs text-muted">
                            {student?.department} ({student?.batch_year || 2026})
                          </div>
                        </td>
                        <td className="max-w-md">
                          <div className="text-xs font-semibold text-primary mb-0.5">
                            Opsi {chosenOption?.option_number || 1}
                          </div>
                          <div className="font-medium text-slate-900 text-sm line-clamp-2">
                            {chosenOption?.title || 'Judul Skripsi'}
                          </div>
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
                        <td>
                          <StatusBadge status={sub.status} size="sm" />
                          {sub.status === 'approved' && sub.nomor_surat && (
                            <div className="mt-1 font-mono text-[10px] text-emerald-700 font-bold">
                              {sub.nomor_surat}
                            </div>
                          )}
                        </td>
                        <td>
                          {fileUrl && fileUrl !== '#' ? (
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-outline-pdf"
                              title="Buka Dokumen PDF Jurnal"
                            >
                              <FileText size={13} />
                              <span>PDF</span>
                              <ExternalLink size={11} />
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Tanpa PDF</span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => setActiveDossierSub(sub)}
                              className="btn btn-sm btn-primary flex items-center gap-1.5"
                              title="Lihat Berkas Dossier Lengkap"
                            >
                              <Eye size={14} />
                              <span>Lihat Berkas</span>
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
      )}

      {/* TAB 2: PROFIL & BEBAN KUOTA DOSEN */}
      {activeTab === 'profile' && currentLecData && (
        <div className="card tab-content mt-6">
          <div className="card-top-action">
            <div>
              <h3 className="card-subhead">Data Dosen Pembimbing & Penetapan Kuota</h3>
              <p className="card-subdesc">
                Rincian informasi akun dosen, bidang kepakaran, dan pemenuhan kuota bimbingan akademik.
              </p>
            </div>
            <div className="status-dot active">Terverifikasi Aktif</div>
          </div>

          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>NIP / Identitas</th>
                  <th>Nama Lengkap</th>
                  <th>Email Institusi</th>
                  <th>Program Studi</th>
                  <th>Bidang Keahlian</th>
                  <th>Kuota Maksimal</th>
                  <th>Beban Saat Ini</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-mono font-bold text-primary">{currentLecData.nip}</td>
                  <td className="font-bold text-slate-800">{currentLecData.name}</td>
                  <td className="text-slate-600 font-mono text-xs">{currentLecData.email}</td>
                  <td>
                    <span className="badge badge-primary">{currentLecData.department_id}</span>
                  </td>
                  <td className="text-slate-700">{currentLecData.expertise || '-'}</td>
                  <td className="font-bold text-slate-800">{currentLecData.quota} Mahasiswa</td>
                  <td>
                    <div className="font-bold text-primary">
                      {activeCount} / {currentLecData.quota} Mahasiswa
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
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
