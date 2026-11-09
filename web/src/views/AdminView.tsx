import React, { useState, useEffect } from 'react';
import { lecturerService } from '../services/lecturerService';
import { masterDataService } from '../services/masterDataService';
import type { Lecturer, Department, BatchYear } from '../types';
import {
  Users,
  Building2,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'lecturers' | 'departments' | 'batch_years'>('lecturers');

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

  // Modal states
  const [isLecturerModalOpen, setIsLecturerModalOpen] = useState<boolean>(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState<boolean>(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);

  // Form states
  const [lecturerForm, setLecturerForm] = useState({
    nip: '',
    name: '',
    email: '',
    department_id: '',
    expertise: '',
    quota: 10,
    role: 'lecturer' as 'lecturer' | 'reviewer' | 'kaprodi' | 'admin',
  });

  const [deptForm, setDeptForm] = useState({
    code: '',
    name: '',
    faculty: '',
  });

  const [batchForm, setBatchForm] = useState({
    year: new Date().getFullYear(),
    label: '',
  });

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

  // Handler: Add Lecturer
  const handleSaveLecturer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!lecturerForm.nip || !lecturerForm.name || !lecturerForm.email) {
        showFeedback('NIP, Nama, dan Email wajib diisi!', 'error');
        return;
      }

      await lecturerService.createLecturer({
        nip: lecturerForm.nip,
        name: lecturerForm.name,
        email: lecturerForm.email,
        department_id: lecturerForm.department_id || departments[0]?.code || 'TI',
        expertise: lecturerForm.expertise,
        quota: Number(lecturerForm.quota),
        current_students: 0,
        role: lecturerForm.role,
        is_active: true,
      });

      setIsLecturerModalOpen(false);
      setLecturerForm({
        nip: '',
        name: '',
        email: '',
        department_id: departments[0]?.code || '',
        expertise: '',
        quota: 10,
        role: 'lecturer',
      });
      showFeedback('Data dosen berhasil disimpan!');
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal menyimpan dosen: ${err.message}`, 'error');
    }
  };

  // Handler: Delete Lecturer
  const handleDeleteLecturer = async (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus data dosen ${name}?`)) {
      try {
        await lecturerService.deleteLecturer(id);
        showFeedback(`Dosen ${name} berhasil dihapus.`);
        loadData();
      } catch (err: any) {
        showFeedback(`Gagal menghapus dosen: ${err.message}`, 'error');
      }
    }
  };

  // Handler: Save Department
  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!deptForm.code || !deptForm.name) {
        showFeedback('Kode dan Nama Jurusan wajib diisi!', 'error');
        return;
      }
      await masterDataService.createDepartment({
        code: deptForm.code.toUpperCase(),
        name: deptForm.name,
        faculty: deptForm.faculty || 'Fakultas Teknik',
        is_active: true,
      });
      setIsDeptModalOpen(false);
      setDeptForm({ code: '', name: '', faculty: '' });
      showFeedback('Program Studi / Departemen berhasil ditambahkan!');
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal menambahkan prodi: ${err.message}`, 'error');
    }
  };

  // Handler: Toggle Dept Active
  const handleToggleDept = async (dept: Department) => {
    try {
      await masterDataService.updateDepartment(dept.$id, {
        is_active: !dept.is_active,
      });
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal mengupdate prodi: ${err.message}`, 'error');
    }
  };

  // Handler: Save Batch Year
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const year = Number(batchForm.year);
      const label = batchForm.label || `Angkatan ${year} (Letting ${String(year).slice(-2)})`;
      await masterDataService.createBatchYear({
        year,
        label,
        is_active: true,
      });
      setIsBatchModalOpen(false);
      setBatchForm({ year: new Date().getFullYear(), label: '' });
      showFeedback('Data Letting / Angkatan berhasil ditambahkan!');
      loadData();
    } catch (err: any) {
      showFeedback(`Gagal menambahkan letting: ${err.message}`, 'error');
    }
  };

  // Filtered lecturers
  const filteredLecturers = lecturers.filter((l) => {
    const matchesSearch =
      l.name.toLowerCase().includes(searchLecturer.toLowerCase()) ||
      l.nip.includes(searchLecturer) ||
      l.email.toLowerCase().includes(searchLecturer.toLowerCase());
    const matchesDept = filterDept === 'all' || l.department_id === filterDept;
    const matchesRole = filterRole === 'all' || l.role === filterRole;
    return matchesSearch && matchesDept && matchesRole;
  });

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
          <h1 className="page-title">Panel Administrator</h1>
          <p className="page-desc">
            Kelola data Dosen, Hak Akses Peran, Master Program Studi, dan Letting Angkatan Mahasiswa.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="tab-pill-group">
          <button
            onClick={() => setActiveTab('lecturers')}
            className={`tab-pill-btn ${activeTab === 'lecturers' ? 'active' : ''}`}
          >
            <Users size={16} />
            <span>Data Dosen ({lecturers.length})</span>
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

      {/* TAB 1: DATA DOSEN */}
      {activeTab === 'lecturers' && (
        <div className="card tab-content">
          <div className="card-top-action">
            <div className="filter-group">
              <div className="search-input-box">
                <Search size={16} color="#94A3B8" />
                <input
                  type="text"
                  placeholder="Cari nama, NIP, atau email..."
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
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              onClick={() => setIsLecturerModalOpen(true)}
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
                  <th>Nama Lengkap & Gelar</th>
                  <th>Prodi</th>
                  <th>Peran (Role)</th>
                  <th>Bidang Keahlian</th>
                  <th>Kuota Bimbingan</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredLecturers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-muted">
                      Tidak ada data dosen yang sesuai filter.
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
                          <div className="text-xs text-muted">{lec.email}</div>
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
                            className={`status-dot ${lec.is_active ? 'active' : 'inactive'}`}
                          >
                            {lec.is_active ? 'Aktif' : 'Non-aktif'}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => handleDeleteLecturer(lec.$id, lec.name)}
                            className="btn-icon-danger"
                            title="Hapus Dosen"
                          >
                            <Trash2 size={16} />
                          </button>
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
              <h3 className="card-subhead">Daftar Program Studi / Jurusan</h3>
              <p className="card-subdesc">
                Data ini menjadi pilihan dropdown bagi mahasiswa baru saat onboarding di aplikasi mobile.
              </p>
            </div>
            <button onClick={() => setIsDeptModalOpen(true)} className="btn btn-primary">
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
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept.$id}>
                    <td className="font-mono font-bold text-primary">{dept.code}</td>
                    <td className="font-semibold text-slate-800">{dept.name}</td>
                    <td className="text-slate-600">{dept.faculty}</td>
                    <td>
                      <span className={`status-dot ${dept.is_active ? 'active' : 'inactive'}`}>
                        {dept.is_active ? 'Aktif' : 'Non-aktif'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleDept(dept)}
                        className={`btn-sm ${dept.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`}
                      >
                        {dept.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))}
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
              <h3 className="card-subhead">Daftar Letting / Angkatan Masuk</h3>
              <p className="card-subdesc">
                Tahun angkatan masuk mahasiswa yang muncul di dropdown registrasi aplikasi mobile.
              </p>
            </div>
            <button onClick={() => setIsBatchModalOpen(true)} className="btn btn-primary">
              <Plus size={16} />
              <span>Tambah Angkatan Baru</span>
            </button>
          </div>

          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Tahun</th>
                  <th>Label Tampilan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {batchYears.map((b) => (
                  <tr key={b.$id}>
                    <td className="font-mono font-bold">{b.year}</td>
                    <td className="font-medium text-slate-800">{b.label}</td>
                    <td>
                      <span className={`status-dot ${b.is_active ? 'active' : 'inactive'}`}>
                        {b.is_active ? 'Aktif' : 'Non-aktif'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Tambah Dosen */}
      {isLecturerModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">Tambah Data Dosen & Hak Akses</h3>
              <button onClick={() => setIsLecturerModalOpen(false)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveLecturer}>
              <div className="modal-body">
                <div className="form-group">
                  <label>NIP / NIDN *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 198501012010121001"
                    value={lecturerForm.nip}
                    onChange={(e) => setLecturerForm({ ...lecturerForm, nip: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Nama Lengkap & Gelar *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Dr. Ir. Budi Santoso, M.Kom."
                    value={lecturerForm.name}
                    onChange={(e) => setLecturerForm({ ...lecturerForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Email Institusi / Akun *</label>
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
                    <label>Peran (Role) *</label>
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
                  Simpan Data Dosen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tambah Departemen / Prodi */}
      {isDeptModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">Tambah Program Studi Baru</h3>
              <button onClick={() => setIsDeptModalOpen(false)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveDept}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Kode Singkatan Prodi (Misal: TI, SI, BD) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: IF"
                    value={deptForm.code}
                    onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Nama Lengkap Program Studi *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Informatika Medis"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Fakultas</label>
                  <input
                    type="text"
                    placeholder="Contoh: Fakultas Teknik"
                    value={deptForm.faculty}
                    onChange={(e) => setDeptForm({ ...deptForm, faculty: e.target.value })}
                  />
                </div>
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
                  Simpan Prodi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tambah Letting / Angkatan */}
      {isBatchModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">Tambah Tahun Letting / Angkatan</h3>
              <button onClick={() => setIsBatchModalOpen(false)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveBatch}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Tahun Angkatan (Contoh: 2025) *</label>
                  <input
                    type="number"
                    required
                    min={2000}
                    max={2040}
                    value={batchForm.year}
                    onChange={(e) => setBatchForm({ ...batchForm, year: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Label Tampilan (Opsional, otomatis jika kosong)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Angkatan 2025 (Letting 25)"
                    value={batchForm.label}
                    onChange={(e) => setBatchForm({ ...batchForm, label: e.target.value })}
                  />
                </div>
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
                  Simpan Letting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
