import React, { useState, useEffect } from 'react';
import { lecturerService } from '../services/lecturerService';
import { masterDataService } from '../services/masterDataService';
import { settingsService } from '../services/settingsService';
import { submissionService } from '../services/submissionService';
import type { Lecturer, Department, BatchYear, SystemSettings, ThesisSubmission } from '../types';
import {
  BarChart3,
  Clock,
  TrendingUp,
  FileText,
} from 'lucide-react';
import {
  Users,
  Building2,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  X,
  Search,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  GraduationCap,
  ShieldCheck,
  Award,
  Layers,
  Lock,
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'lecturers' | 'departments' | 'batch_years' | 'settings' | 'reports'>('lecturers');
  const [submissions, setSubmissions] = useState<ThesisSubmission[]>([]);
  const [reportSearch, setReportSearch] = useState<string>('');
  const [reportDeptFilter, setReportDeptFilter] = useState<string>('all');

  const [settings, setSettings] = useState<SystemSettings>({
    is_active: true,
    start_date: '',
    end_date: '',
    academic_year: '2025/2026 Ganjil',
  });
  const [totalVerifiedSubmissions, setTotalVerifiedSubmissions] = useState<number>(0);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(false);

  // Data states
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batchYears, setBatchYears] = useState<BatchYear[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Search & Filter
  const [searchLecturer, setSearchLecturer] = useState<string>('');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modal open states
  const [isLecturerModalOpen, setIsLecturerModalOpen] = useState<boolean>(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState<boolean>(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);

  // Editing items (null means creating new)
  const [editingLecturer, setEditingLecturer] = useState<Lecturer | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingBatch, setEditingBatch] = useState<BatchYear | null>(null);

  // Form states
  const [lecturerForm, setLecturerForm] = useState({
    nip: '',
    name: '',
    email: '',
    department_id: '',
    expertise: '',
    quota: 10,
    role: 'lecturer' as 'lecturer' | 'reviewer' | 'kaprodi' | 'admin',
    is_active: true,
  });

  const [deptForm, setDeptForm] = useState({
    code: '',
    name: '',
    faculty: '',
    is_active: true,
  });

  const [batchForm, setBatchForm] = useState({
    year: new Date().getFullYear(),
    label: '',
    is_active: true,
  });

  // Security Delete Confirmation Modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'lecturer' | 'department' | 'batch_year';
    id: string;
    title: string;
    subtitle: string;
    expectedValue: string;
  } | null>(null);
  const [inputConfirmValue, setInputConfirmValue] = useState<string>('');
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

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
      const [lRes, dRes, bRes] = await Promise.all([
        lecturerService.getLecturers(),
        masterDataService.getDepartments(),
        masterDataService.getBatchYears(),
      ]);
      setLecturers(lRes);
      setDepartments(dRes);
      setBatchYears(bRes);
      if (dRes.length > 0 && !lecturerForm.department_id) {
        setLecturerForm((prev) => ({ ...prev, department_id: dRes[0].code }));
      }
    } catch (err: any) {
      showFeedback(`Gagal memuat data: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    try {
      await settingsService.updateSettings(settings);
      showFeedback('Pengaturan masa pengajuan berhasil disimpan!', 'success');
    } catch (err: any) {
      showFeedback(`Gagal menyimpan pengaturan: ${err.message}`, 'error');
    } finally {
      setSettingsLoading(false);
    }
  };

  // Open Lecturer Modal (Add or Edit)
  const handleOpenLecturerModal = (lec?: Lecturer) => {
    if (lec) {
      setEditingLecturer(lec);
      setLecturerForm({
        nip: lec.nip,
        name: lec.name,
        email: lec.email,
        department_id: lec.department_id,
        expertise: lec.expertise || '',
        quota: lec.quota || 10,
        role: lec.role as any,
        is_active: lec.is_active !== false,
      });
    } else {
      setEditingLecturer(null);
      setLecturerForm({
        nip: '',
        name: '',
        email: '',
        department_id: departments[0]?.code || 'TI',
        expertise: '',
        quota: 10,
        role: 'lecturer',
        is_active: true,
      });
    }
    setIsLecturerModalOpen(true);
  };

  // Save Lecturer (Create or Update)
  const handleSaveLecturer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!lecturerForm.nip || !lecturerForm.name || !lecturerForm.email) {
        showFeedback('NIP, Nama, dan Email wajib diisi!', 'error');
        return;
      }

      if (editingLecturer) {
        await lecturerService.updateLecturer(editingLecturer.$id, {
          nip: lecturerForm.nip.trim(),
          name: lecturerForm.name.trim(),
          email: lecturerForm.email.trim(),
          department_id: lecturerForm.department_id,
          expertise: lecturerForm.expertise.trim(),
          quota: Number(lecturerForm.quota),
          role: lecturerForm.role,
          is_active: lecturerForm.is_active,
        });
        showFeedback(`Perubahan data dosen ${lecturerForm.name} berhasil disimpan!`);
      } else {
        await lecturerService.createLecturer({
          nip: lecturerForm.nip.trim(),
          name: lecturerForm.name.trim(),
          email: lecturerForm.email.trim(),
          department_id: lecturerForm.department_id || departments[0]?.code || 'TI',
          expertise: lecturerForm.expertise.trim(),
          quota: Number(lecturerForm.quota),
          current_students: 0,
          role: lecturerForm.role,
          is_active: true,
        });
        showFeedback(`Dosen baru ${lecturerForm.name} berhasil ditambahkan!`);
      }

      setIsLecturerModalOpen(false);
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal menyimpan dosen: ${err.message}`, 'error');
    }
  };

  // Open Department Modal (Add or Edit)
  const handleOpenDeptModal = (dept?: Department) => {
    if (dept) {
      setEditingDept(dept);
      setDeptForm({
        code: dept.code,
        name: dept.name,
        faculty: dept.faculty || '',
        is_active: dept.is_active !== false,
      });
    } else {
      setEditingDept(null);
      setDeptForm({
        code: '',
        name: '',
        faculty: 'Fakultas Teknik',
        is_active: true,
      });
    }
    setIsDeptModalOpen(true);
  };

  // Save Department
  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!deptForm.code || !deptForm.name) {
        showFeedback('Kode dan Nama Jurusan wajib diisi!', 'error');
        return;
      }

      if (editingDept) {
        await masterDataService.updateDepartment(editingDept.$id, {
          code: deptForm.code.trim().toUpperCase(),
          name: deptForm.name.trim(),
          faculty: deptForm.faculty.trim() || 'Fakultas Teknik',
          is_active: deptForm.is_active,
        });
        showFeedback(`Program Studi ${deptForm.name} berhasil diperbarui!`);
      } else {
        await masterDataService.createDepartment({
          code: deptForm.code.trim().toUpperCase(),
          name: deptForm.name.trim(),
          faculty: deptForm.faculty.trim() || 'Fakultas Teknik',
          is_active: true,
        });
        showFeedback(`Program Studi ${deptForm.name} berhasil ditambahkan!`);
      }

      setIsDeptModalOpen(false);
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal menyimpan program studi: ${err.message}`, 'error');
    }
  };

  // Open Batch Year Modal (Add or Edit)
  const handleOpenBatchModal = (batch?: BatchYear) => {
    if (batch) {
      setEditingBatch(batch);
      setBatchForm({
        year: batch.year,
        label: batch.label,
        is_active: batch.is_active !== false,
      });
    } else {
      setEditingBatch(null);
      const currYear = new Date().getFullYear();
      setBatchForm({
        year: currYear,
        label: `Angkatan ${currYear} (Letting ${String(currYear).slice(-2)})`,
        is_active: true,
      });
    }
    setIsBatchModalOpen(true);
  };

  // Save Batch Year
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const year = Number(batchForm.year);
      const label = batchForm.label.trim() || `Angkatan ${year} (Letting ${String(year).slice(-2)})`;

      if (editingBatch) {
        await masterDataService.updateBatchYear(editingBatch.$id, {
          year,
          label,
          is_active: batchForm.is_active,
        });
        showFeedback(`Data Letting ${year} berhasil diperbarui!`);
      } else {
        await masterDataService.createBatchYear({
          year,
          label,
          is_active: true,
        });
        showFeedback(`Data Letting ${year} berhasil ditambahkan!`);
      }

      setIsBatchModalOpen(false);
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal menyimpan letting: ${err.message}`, 'error');
    }
  };

  // Toggle active status handlers
  const handleToggleDeptActive = async (dept: Department) => {
    try {
      await masterDataService.updateDepartment(dept.$id, {
        is_active: !dept.is_active,
      });
      showFeedback(`Status prodi ${dept.code} diubah menjadi ${!dept.is_active ? 'Aktif' : 'Non-aktif'}.`);
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal mengubah status prodi: ${err.message}`, 'error');
    }
  };

  const handleToggleBatchActive = async (batch: BatchYear) => {
    try {
      await masterDataService.updateBatchYear(batch.$id, {
        is_active: !batch.is_active,
      });
      showFeedback(`Status letting ${batch.year} diubah menjadi ${!batch.is_active ? 'Aktif' : 'Non-aktif'}.`);
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal mengubah status letting: ${err.message}`, 'error');
    }
  };

  // TRIGGER SECURITY DELETE MODAL (Requires exact retype)
  const triggerDeleteLecturer = (lec: Lecturer) => {
    setInputConfirmValue('');
    setDeleteModal({
      isOpen: true,
      type: 'lecturer',
      id: lec.$id,
      title: lec.name,
      subtitle: `NIP: ${lec.nip} · Prodi: ${lec.department_id}`,
      expectedValue: lec.nip,
    });
  };

  const triggerDeleteDepartment = (dept: Department) => {
    setInputConfirmValue('');
    setDeleteModal({
      isOpen: true,
      type: 'department',
      id: dept.$id,
      title: `${dept.code} - ${dept.name}`,
      subtitle: `Fakultas: ${dept.faculty}`,
      expectedValue: dept.code,
    });
  };

  const triggerDeleteBatch = (batch: BatchYear) => {
    setInputConfirmValue('');
    setDeleteModal({
      isOpen: true,
      type: 'batch_year',
      id: batch.$id,
      title: batch.label,
      subtitle: `Tahun Angkatan: ${batch.year}`,
      expectedValue: String(batch.year),
    });
  };

  // EXECUTE SECURITY DELETE
  const handleExecuteDelete = async () => {
    if (!deleteModal) return;
    if (inputConfirmValue.trim() !== deleteModal.expectedValue.trim()) {
      showFeedback('Nilai konfirmasi tidak cocok. Penghapusan dibatalkan demi keamanan.', 'error');
      return;
    }

    setDeleteLoading(true);
    try {
      if (deleteModal.type === 'lecturer') {
        await lecturerService.deleteLecturer(deleteModal.id);
        showFeedback(`Data dosen ${deleteModal.title} berhasil dihapus permanen.`);
      } else if (deleteModal.type === 'department') {
        await masterDataService.deleteDepartment(deleteModal.id);
        showFeedback(`Program Studi ${deleteModal.title} berhasil dihapus permanen.`);
      } else if (deleteModal.type === 'batch_year') {
        await masterDataService.deleteBatchYear(deleteModal.id);
        showFeedback(`Data Letting ${deleteModal.title} berhasil dihapus permanen.`);
      }
      setDeleteModal(null);
      setInputConfirmValue('');
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal menghapus data: ${err.message}`, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filtered lecturers
  const filteredLecturers = lecturers.filter((l) => {
    const matchesSearch =
      l.name.toLowerCase().includes(searchLecturer.toLowerCase()) ||
      l.nip.includes(searchLecturer) ||
      l.email.toLowerCase().includes(searchLecturer.toLowerCase()) ||
      (l.expertise && l.expertise.toLowerCase().includes(searchLecturer.toLowerCase()));
    const matchesDept = filterDept === 'all' || l.department_id === filterDept;
    const matchesRole = filterRole === 'all' || l.role === filterRole;
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'active'
        ? l.is_active !== false
        : l.is_active === false;
    return matchesSearch && matchesDept && matchesRole && matchesStatus;
  });

  // Calculate Metrics
  const totalLecturers = lecturers.length;
  const advisorsCount = lecturers.filter((l) => l.role === 'lecturer').length;
  const reviewersCount = lecturers.filter((l) => l.role === 'reviewer').length;
  const kaprodiCount = lecturers.filter((l) => l.role === 'kaprodi').length;
  const activeDepts = departments.filter((d) => d.is_active !== false).length;
  const activeBatches = batchYears.filter((b) => b.is_active !== false).length;

  return (
    <div className="admin-container">
      {/* Toast Feedback */}
      {feedback && (
        <div className={`feedback-toast ${feedback.type}`}>
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="section-header">
        <div>
          <h1 className="page-title">Panel Manajemen Administrator</h1>
          <p className="page-desc">
            Manajemen master data akademik berstandar enterprise: Dosen & Hak Akses, Program Studi, dan Letting Angkatan.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="tab-pill-group">
          <button
            onClick={() => setActiveTab('lecturers')}
            className={`tab-pill-btn ${activeTab === 'lecturers' ? 'active' : ''}`}
          >
            <Users size={16} />
            <span>Manajemen Dosen ({lecturers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={`tab-pill-btn ${activeTab === 'departments' ? 'active' : ''}`}
          >
            <Building2 size={16} />
            <span>Program Studi ({departments.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('batch_years')}
            className={`tab-pill-btn ${activeTab === 'batch_years' ? 'active' : ''}`}
          >
            <Calendar size={16} />
            <span>Letting / Angkatan ({batchYears.length})</span>
          </button>
        </div>
      </div>

      {/* Management-Grade Metric Bar */}
      <div className="stat-metric-bar">
        <div className="metric-card">
          <div className="metric-icon-circle" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
            <Award size={20} />
          </div>
          <div>
            <div className="metric-val">{totalVerifiedSubmissions}</div>
            <div className="metric-label">Pengajuan Terverifikasi</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon-circle" style={{ backgroundColor: '#EFF6FF', color: '#0A4C8F' }}>
            <Users size={20} />
          </div>
          <div>
            <div className="metric-val">{totalLecturers}</div>
            <div className="metric-label">Total Civitas Dosen</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle" style={{ backgroundColor: '#F3E8FF', color: '#6B21A8' }}>
            <GraduationCap size={20} />
          </div>
          <div>
            <div className="metric-val">{advisorsCount}</div>
            <div className="metric-label">Dosen Pembimbing</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="metric-val">{reviewersCount}</div>
            <div className="metric-label">Dosen Penilai / Reviewer</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle" style={{ backgroundColor: '#ECFDF5', color: '#047857' }}>
            <Award size={20} />
          </div>
          <div>
            <div className="metric-val">{kaprodiCount}</div>
            <div className="metric-label">Ketua Program Studi (Kaprodi)</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle" style={{ backgroundColor: '#E0F2FE', color: '#0369A1' }}>
            <Building2 size={20} />
          </div>
          <div>
            <div className="metric-val">{activeDepts}</div>
            <div className="metric-label">Program Studi Aktif</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-circle" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
            <Layers size={20} />
          </div>
          <div>
            <div className="metric-val">{activeBatches}</div>
            <div className="metric-label">Letting Angkatan Aktif</div>
          </div>
        </div>
      </div>

      {/* TAB 1: DATA DOSEN */}
      {activeTab === 'lecturers' && (
        <div className="card tab-content">
          <div className="card-top-action">
            <div className="filter-group">
              <div className="search-input-box">
                <Search size={16} color="#94A3B8" />
                <input
                  type="text"
                  placeholder="Cari nama, NIP, keahlian..."
                  value={searchLecturer}
                  onChange={(e) => setSearchLecturer(e.target.value)}
                />
              </div>

              <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
                <option value="all">Semua Prodi</option>
                {departments.map((d) => (
                  <option key={d.$id} value={d.code}>
                    {d.code} - {d.name}
                  </option>
                ))}
              </select>

              <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                <option value="all">Semua Peran</option>
                <option value="reviewer">Reviewer</option>
                <option value="kaprodi">Kaprodi</option>
                <option value="lecturer">Pembimbing</option>
                <option value="admin">Administrator</option>
              </select>

              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">Semua Status</option>
                <option value="active">Hanya Aktif</option>
                <option value="inactive">Non-aktif</option>
              </select>
            </div>

            <button
              onClick={() => handleOpenLecturerModal()}
              className="btn btn-primary"
            >
              <Plus size={16} />
              <span>Tambah Dosen Baru</span>
            </button>
          </div>

          {/* Table */}
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>NIP / NIDN</th>
                  <th>Nama Lengkap & Email</th>
                  <th>Prodi</th>
                  <th>Peran (Role)</th>
                  <th>Bidang Keahlian</th>
                  <th>Beban Kuota</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredLecturers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-muted">
                      {loading ? 'Memuat data dosen...' : 'Tidak ada data dosen yang sesuai filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredLecturers.map((lec) => {
                    const quotaPercent = Math.min(
                      Math.round(((lec.current_students || 0) / (lec.quota || 1)) * 100),
                      100
                    );
                    return (
                      <tr key={lec.$id}>
                        <td className="font-mono text-xs">{lec.nip}</td>
                        <td className="font-semibold text-slate-800">
                          <div>{lec.name}</div>
                          <div className="text-xs text-muted font-normal">{lec.email}</div>
                        </td>
                        <td>
                          <span className="badge badge-dept">{lec.department_id}</span>
                        </td>
                        <td>
                          <span className={`badge badge-role-${lec.role}`}>
                            {lec.role === 'reviewer'
                              ? 'Dosen Penilai'
                              : lec.role === 'kaprodi'
                              ? 'Kaprodi'
                              : lec.role === 'admin'
                              ? 'Administrator'
                              : 'Pembimbing'}
                          </span>
                        </td>
                        <td className="text-xs text-slate-600 max-w-xs">{lec.expertise || '-'}</td>
                        <td>
                          <div className="quota-bar-wrapper">
                            <div className="quota-info">
                              <span>
                                {lec.current_students || 0} / {lec.quota} mhs
                              </span>
                              <span>{quotaPercent}%</span>
                            </div>
                            <div className="quota-bar-bg">
                              <div
                                className="quota-bar-fill"
                                style={{
                                  width: `${quotaPercent}%`,
                                  backgroundColor: quotaPercent >= 100 ? '#EF4444' : '#0A4C8F',
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`status-dot ${lec.is_active !== false ? 'active' : 'inactive'}`}
                          >
                            {lec.is_active !== false ? 'Aktif' : 'Non-aktif'}
                          </span>
                        </td>
                        <td>
                          <div className="action-button-group" style={{ justifyContent: 'center' }}>
                            <button
                              onClick={() => handleOpenLecturerModal(lec)}
                              className="btn-icon-secondary"
                              title="Edit Data Dosen"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => triggerDeleteLecturer(lec)}
                              className="btn-icon-danger"
                              title="Hapus Data Dosen (Dengan Verifikasi)"
                            >
                              <Trash2 size={15} />
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

      {/* TAB 2: DATA PROGRAM STUDI */}
      {activeTab === 'departments' && (
        <div className="card tab-content">
          <div className="card-top-action">
            <div>
              <h3 className="card-subhead">Master Program Studi / Jurusan</h3>
              <p className="card-subdesc">
                Data master ini dijadikan acuan dropdown pendaftaran mahasiswa baru di aplikasi mobile dan plotting fakultas.
              </p>
            </div>
            <button onClick={() => handleOpenDeptModal()} className="btn btn-primary">
              <Plus size={16} />
              <span>Tambah Program Studi</span>
            </button>
          </div>

          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Kode Prodi</th>
                  <th>Nama Program Studi</th>
                  <th>Fakultas</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {departments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-muted">
                      {loading ? 'Memuat master prodi...' : 'Belum ada data program studi.'}
                    </td>
                  </tr>
                ) : (
                  departments.map((dept) => (
                    <tr key={dept.$id}>
                      <td className="font-mono font-bold text-primary">{dept.code}</td>
                      <td className="font-semibold text-slate-800">{dept.name}</td>
                      <td className="text-slate-600">{dept.faculty}</td>
                      <td>
                        <span className={`status-dot ${dept.is_active !== false ? 'active' : 'inactive'}`}>
                          {dept.is_active !== false ? 'Aktif' : 'Non-aktif'}
                        </span>
                      </td>
                      <td>
                        <div className="action-button-group" style={{ justifyContent: 'center' }}>
                          <button
                            onClick={() => handleOpenDeptModal(dept)}
                            className="btn-icon-secondary"
                            title="Edit Data Program Studi"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleToggleDeptActive(dept)}
                            className={`btn-sm ${dept.is_active !== false ? 'btn-outline-danger' : 'btn-outline-success'}`}
                          >
                            {dept.is_active !== false ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button
                            onClick={() => triggerDeleteDepartment(dept)}
                            className="btn-icon-danger"
                            title="Hapus Program Studi (Dengan Verifikasi)"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DATA LETTING / ANGKATAN */}
      {activeTab === 'batch_years' && (
        <div className="card tab-content">
          <div className="card-top-action">
            <div>
              <h3 className="card-subhead">Master Letting & Angkatan Mahasiswa</h3>
              <p className="card-subdesc">
                Tahun angkatan masuk resmi yang digunakan mahasiswa untuk memilih letting saat onboarding aplikasi mobile.
              </p>
            </div>
            <button onClick={() => handleOpenBatchModal()} className="btn btn-primary">
              <Plus size={16} />
              <span>Tambah Angkatan Baru</span>
            </button>
          </div>

          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Tahun</th>
                  <th>Label Tampilan Dropdown</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {batchYears.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-muted">
                      {loading ? 'Memuat data letting...' : 'Belum ada data letting angkatan.'}
                    </td>
                  </tr>
                ) : (
                  batchYears.map((b) => (
                    <tr key={b.$id}>
                      <td className="font-mono font-bold">{b.year}</td>
                      <td className="font-medium text-slate-800">{b.label}</td>
                      <td>
                        <span className={`status-dot ${b.is_active !== false ? 'active' : 'inactive'}`}>
                          {b.is_active !== false ? 'Aktif' : 'Non-aktif'}
                        </span>
                      </td>
                      <td>
                        <div className="action-button-group" style={{ justifyContent: 'center' }}>
                          <button
                            onClick={() => handleOpenBatchModal(b)}
                            className="btn-icon-secondary"
                            title="Edit Data Letting"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleToggleBatchActive(b)}
                            className={`btn-sm ${b.is_active !== false ? 'btn-outline-danger' : 'btn-outline-success'}`}
                          >
                            {b.is_active !== false ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button
                            onClick={() => triggerDeleteBatch(b)}
                            className="btn-icon-danger"
                            title="Hapus Letting (Dengan Verifikasi)"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Tambah / Edit Dosen */}
      {isLecturerModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">
                {editingLecturer ? 'Edit Data Dosen & Peran' : 'Tambah Data Dosen & Hak Akses'}
              </h3>
              <button onClick={() => setIsLecturerModalOpen(false)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveLecturer}>
              <div className="modal-body">
                <div className="form-group">
                  <label>NIP / NIDN Dosen *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 198501012010121001"
                    value={lecturerForm.nip}
                    onChange={(e) => setLecturerForm({ ...lecturerForm, nip: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Nama Lengkap Beserta Gelar Akademik *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Dr. Ir. Budi Santoso, M.Kom."
                    value={lecturerForm.name}
                    onChange={(e) => setLecturerForm({ ...lecturerForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Alamat Email Institusi / Akun Login *</label>
                  <input
                    type="email"
                    required
                    placeholder="Contoh: budi.santoso@spsm.ac.id"
                    value={lecturerForm.email}
                    onChange={(e) => setLecturerForm({ ...lecturerForm, email: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Program Studi (Departemen) *</label>
                    <select
                      value={lecturerForm.department_id}
                      onChange={(e) =>
                        setLecturerForm({ ...lecturerForm, department_id: e.target.value })
                      }
                    >
                      {departments.map((d) => (
                        <option key={d.$id} value={d.code}>
                          {d.code} - {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Peran dalam Sistem *</label>
                    <select
                      value={lecturerForm.role}
                      onChange={(e) =>
                        setLecturerForm({
                          ...lecturerForm,
                          role: e.target.value as any,
                        })
                      }
                    >
                      <option value="lecturer">Dosen Pembimbing</option>
                      <option value="reviewer">Dosen Penilai (Reviewer)</option>
                      <option value="kaprodi">Ketua Program Studi (Kaprodi)</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Batas Kuota Bimbingan (Maks. Mahasiswa)</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={lecturerForm.quota}
                      onChange={(e) =>
                        setLecturerForm({ ...lecturerForm, quota: Number(e.target.value) })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Bidang Keahlian / Minat Riset</label>
                    <input
                      type="text"
                      placeholder="Contoh: AI, Web Mobile, Data Science"
                      value={lecturerForm.expertise}
                      onChange={(e) =>
                        setLecturerForm({ ...lecturerForm, expertise: e.target.value })
                      }
                    />
                  </div>
                </div>

                {editingLecturer && (
                  <div className="form-group">
                    <label>Status Akun Dosen</label>
                    <select
                      value={lecturerForm.is_active ? 'active' : 'inactive'}
                      onChange={(e) =>
                        setLecturerForm({ ...lecturerForm, is_active: e.target.value === 'active' })
                      }
                    >
                      <option value="active">Aktif (Dapat dipilih)</option>
                      <option value="inactive">Non-aktif</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsLecturerModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingLecturer ? 'Simpan Perubahan' : 'Tambahkan Dosen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Tambah / Edit Program Studi */}
      {isDeptModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">
                {editingDept ? 'Edit Program Studi' : 'Tambah Program Studi Baru'}
              </h3>
              <button onClick={() => setIsDeptModalOpen(false)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveDept}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Kode Program Studi (Singkatan Huruf Kapital) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: TI, SI, IF, TE"
                    value={deptForm.code}
                    onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                  />
                </div>

                <div className="form-group">
                  <label>Nama Lengkap Program Studi *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Teknik Informatika"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Fakultas Naungan</label>
                  <input
                    type="text"
                    placeholder="Contoh: Fakultas Teknik"
                    value={deptForm.faculty}
                    onChange={(e) => setDeptForm({ ...deptForm, faculty: e.target.value })}
                  />
                </div>

                {editingDept && (
                  <div className="form-group">
                    <label>Status Program Studi</label>
                    <select
                      value={deptForm.is_active ? 'active' : 'inactive'}
                      onChange={(e) =>
                        setDeptForm({ ...deptForm, is_active: e.target.value === 'active' })
                      }
                    >
                      <option value="active">Aktif (Tampil di Dropdown Mobile)</option>
                      <option value="inactive">Non-aktif</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingDept ? 'Simpan Perubahan' : 'Tambahkan Prodi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Tambah / Edit Letting Angkatan */}
      {isBatchModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">
                {editingBatch ? 'Edit Data Letting / Angkatan' : 'Tambah Letting Angkatan Baru'}
              </h3>
              <button onClick={() => setIsBatchModalOpen(false)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveBatch}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Tahun Angkatan Masuk *</label>
                  <input
                    type="number"
                    required
                    min={2000}
                    max={2100}
                    value={batchForm.year}
                    onChange={(e) => setBatchForm({ ...batchForm, year: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label>Label Tampilan Dropdown *</label>
                  <input
                    type="text"
                    placeholder={`Contoh: Angkatan ${batchForm.year} (Letting ${String(batchForm.year).slice(-2)})`}
                    value={batchForm.label}
                    onChange={(e) => setBatchForm({ ...batchForm, label: e.target.value })}
                  />
                </div>

                {editingBatch && (
                  <div className="form-group">
                    <label>Status Letting</label>
                    <select
                      value={batchForm.is_active ? 'active' : 'inactive'}
                      onChange={(e) =>
                        setBatchForm({ ...batchForm, is_active: e.target.value === 'active' })
                      }
                    >
                      <option value="active">Aktif (Tampil di Dropdown Mobile)</option>
                      <option value="inactive">Non-aktif</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingBatch ? 'Simpan Perubahan' : 'Tambahkan Angkatan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: SECURITY SAFEGUARD DELETE CONFIRMATION (Requires Exact Retype) */}
      {deleteModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 520 }}>
            <div className="modal-header" style={{ borderBottomColor: '#FEE2E2', backgroundColor: '#FFF5F5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: '#FEE2E2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#DC2626',
                  }}
                >
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ color: '#991B1B', fontSize: 16 }}>
                    Konfirmasi Keamanan Penghapusan Data
                  </h3>
                  <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>
                    Tindakan ini permanen dan berisiko tinggi
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setDeleteModal(null);
                  setInputConfirmValue('');
                }}
                className="btn-close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="security-alert-box">
                <div className="security-alert-header">
                  <Lock size={16} />
                  <span>Sistem Proteksi Master Data Akademik</span>
                </div>
                <div className="security-alert-body">
                  Data yang dihapus tidak dapat dipulihkan. Menghapus record ini dapat berdampak pada relasi data pengajuan skripsi, kuota bimbingan, atau registrasi mahasiswa.
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 10,
                  padding: '12px 16px',
                  border: '1px solid #E2E8F0',
                  marginBottom: 18,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                  Target Objek yang Dihapus:
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>
                  {deleteModal.title}
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  {deleteModal.subtitle}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 13, color: '#334155' }}>
                  Untuk mengonfirmasi penghapusan secara aman, ketik ulang kode/nilai verifikasi berikut:{' '}
                  <span className="retype-highlight">{deleteModal.expectedValue}</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  className={`retype-input ${
                    inputConfirmValue.trim() === deleteModal.expectedValue.trim() ? 'matched' : ''
                  }`}
                  placeholder={`Ketik "${deleteModal.expectedValue}" di sini...`}
                  value={inputConfirmValue}
                  onChange={(e) => setInputConfirmValue(e.target.value)}
                />

                {inputConfirmValue.length > 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      marginTop: 6,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      color:
                        inputConfirmValue.trim() === deleteModal.expectedValue.trim()
                          ? '#059669'
                          : '#DC2626',
                    }}
                  >
                    {inputConfirmValue.trim() === deleteModal.expectedValue.trim() ? (
                      <>
                        <CheckCircle size={14} />
                        <span>Verifikasi cocok. Tombol hapus telah dibuka.</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={14} />
                        <span>Teks belum sesuai dengan nilai verifikasi di atas.</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer justify-between" style={{ backgroundColor: '#FFF5F5' }}>
              <button
                type="button"
                onClick={() => {
                  setDeleteModal(null);
                  setInputConfirmValue('');
                }}
                className="btn btn-secondary"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={inputConfirmValue.trim() !== deleteModal.expectedValue.trim() || deleteLoading}
                onClick={handleExecuteDelete}
                className="btn btn-danger"
              >
                <Trash2 size={16} />
                <span>{deleteLoading ? 'Menghapus...' : 'Hapus Permanen Data Ini'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
