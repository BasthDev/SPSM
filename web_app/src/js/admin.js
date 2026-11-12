import { lecturerService, masterDataService, settingsService } from './spsm.js';

let lecturers = [];
let departments = [];
let batchYears = [];

// State modal hapus generik
let pendingDelete = null; // { type: 'lecturer'|'department'|'batch', id, expected }

async function init() {
  try {
    const [lecList, deptList, batchList, settings] = await Promise.all([
      lecturerService.getLecturers(),
      masterDataService.getDepartments(),
      masterDataService.getBatchYears(),
      settingsService.getSettings(),
    ]);

    lecturers = lecList;
    departments = deptList;
    batchYears = batchList;

    renderLecturersTable();
    renderDepartments();
    renderBatchYears();
    fillSettingsForm(settings);
  } catch (err) {
    console.error('Admin init failed:', err);
  }
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast-feedback-admin');
  if (!toast) return;
  toast.innerText = message;
  toast.className = `py-2 px-4 rounded-lg text-xs font-bold ${
    isError ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
  }`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4000);
}

window.switchAdminTab = (tabName, btn) => {
  document.querySelectorAll('.admin-tab-btn').forEach((b) => {
    b.classList.remove('active', 'text-primary', 'border-primary');
    b.classList.add('text-muted', 'border-transparent');
  });
  if (btn) {
    btn.classList.add('active', 'text-primary', 'border-primary');
    btn.classList.remove('text-muted', 'border-transparent');
  }

  document.querySelectorAll('.admin-tab-section').forEach((s) => s.classList.add('hidden'));
  const target = document.getElementById(`admintab-${tabName}`);
  if (target) {
    target.classList.remove('hidden');
    if (tabName === 'masterdata') {
      target.classList.add('grid');
    }
  }
};

// ============ LECTURERS ============

function deptDisplayName(code) {
  if (!code) return '-';
  const hit = departments.find(
    (d) => d.code === code || (d.$id || d.id) === code || d.name === code
  );
  return hit ? hit.name : code;
}

function renderLecturersTable() {
  const tbody = document.getElementById('lecturers-table-body');
  const countBadge = document.getElementById('lecturer-total-badge');
  const searchInput = document.getElementById('search-lecturer');
  const q = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const filtered = lecturers.filter((l) => {
    if (!q) return true;
    return (
      (l.name || '').toLowerCase().includes(q) ||
      (l.nip || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.expertise || '').toLowerCase().includes(q)
    );
  });

  if (countBadge) countBadge.innerText = `Total: ${filtered.length} dosen`;
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-muted italic">Tidak ada dosen ditemukan.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((lec, idx) => {
      const quota = lec.quota || 10;
      const current = lec.current_students || 0;
      const pct = Math.min(100, Math.round((current / quota) * 100));

      return `
      <tr class="hover:bg-subtle/80 transition-colors">
        <td class="py-3 px-4">
          <div class="font-bold text-default">${lec.name}</div>
          <div class="font-mono text-muted text-[11px]">NIP: ${lec.nip}</div>
        </td>
        <td class="py-3 px-4 text-muted">${lec.email || '-'}</td>
        <td class="py-3 px-4">
          <span class="badge badge-neutral text-xs px-2 py-0.5">${deptDisplayName(lec.department_id) || 'TI'}</span>
          <div class="text-[11px] text-muted mt-0.5 line-clamp-1">${lec.expertise || '-'}</div>
        </td>
        <td class="py-3 px-4">
          <div class="relative min-w-[160px]">
            <select
              class="form-select w-full text-xs font-semibold h-8 ps-2.5 pe-8 bg-default border border-default rounded-lg text-default hover:border-primary focus:border-primary cursor-pointer shadow-2xs transition"
              onchange="changeLecturerRole('${lec.$id}', this.value)"
            >
              <option value="lecturer" ${lec.role === 'lecturer' ? 'selected' : ''}>Dosen Pembimbing</option>
              <option value="reviewer" ${lec.role === 'reviewer' ? 'selected' : ''}>Dosen Penilai</option>
              <option value="kaprodi" ${lec.role === 'kaprodi' ? 'selected' : ''}>Ketua Prodi</option>
              <option value="admin" ${lec.role === 'admin' ? 'selected' : ''}>Administrator</option>
            </select>
          </div>
        </td>
        <td class="py-3 px-4 min-w-[140px]">
          <div class="flex items-center justify-between text-[11px] mb-1">
            <span class="font-bold text-default">${current} / ${quota} mhs</span>
            <span class="text-muted font-mono">${pct}%</span>
          </div>
          <div class="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div class="h-full ${pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary'}" style="width: ${pct}%"></div>
          </div>
        </td>
        <td class="py-3 px-4 text-center whitespace-nowrap space-x-1.5">
          <button
            type="button"
            class="btn btn-outline-neutral text-xs py-1 px-2.5 rounded-lg"
            onclick="editLecturer('${lec.$id}')"
          >
            Edit
          </button>
          <button
            type="button"
            class="btn btn-outline-neutral text-xs py-1 px-2 text-rose-600 hover:bg-rose-50 rounded-lg"
            onclick="requestDelete('lecturer', '${lec.$id}', '${(lec.name || '').replace(/'/g, "\\'")}')"
          >
            Hapus
          </button>
        </td>
      </tr>`;
    })
    .join('');
}

window.changeLecturerRole = async (lecturerId, newRole) => {
  try {
    await lecturerService.updateRole(lecturerId, newRole);
    showToast('Hak akses peran dosen berhasil diperbarui!');
  } catch (err) {
    showToast(`Gagal mengubah peran: ${err.message}`, true);
  }
};

window.editLecturer = (id) => {
  const lec = lecturers.find((l) => l.$id === id);
  if (!lec) return;

  document.getElementById('lecturer-modal-title').innerText = 'Edit Data Dosen';
  document.getElementById('form-lecturer-id').value = lec.$id;
  document.getElementById('form-lecturer-nip').value = lec.nip;
  document.getElementById('form-lecturer-name').value = lec.name;
  document.getElementById('form-lecturer-email').value = lec.email;
  document.getElementById('form-lecturer-dept').value = lec.department_id || 'TI';
  document.getElementById('form-lecturer-quota').value = lec.quota || 10;
  document.getElementById('form-lecturer-expertise').value = lec.expertise || '';
  document.getElementById('form-lecturer-role').value = lec.role || 'lecturer';

  document.getElementById('lecturer-modal').classList.remove('hidden');
};

window.closeLecturerModal = () => {
  document.getElementById('lecturer-modal').classList.add('hidden');
};

// ============ DELETE VERIFICATION ============

window.requestDelete = (type, id, displayName) => {
  const labels = {
    lecturer: 'data dosen',
    department: 'program studi',
    batch: 'data angkatan',
  };
  pendingDelete = { type, id, expected: displayName };

  document.getElementById('delete-modal-desc').innerText =
    `Anda akan menghapus ${labels[type] || 'data'} "${displayName}". Tindakan ini tidak dapat dibatalkan.`;
  document.getElementById('delete-modal-expected').innerText = displayName;
  document.getElementById('delete-modal-input').value = '';
  document.getElementById('delete-modal-error').classList.add('hidden');
  document.getElementById('btn-confirm-delete').disabled = true;
  document.getElementById('delete-modal').classList.remove('hidden');
};

window.closeDeleteModal = () => {
  document.getElementById('delete-modal').classList.add('hidden');
  pendingDelete = null;
};

function setupDeleteModal() {
  const input = document.getElementById('delete-modal-input');
  const btn = document.getElementById('btn-confirm-delete');
  if (!input || !btn) return;

  input.addEventListener('input', () => {
    const ok = pendingDelete && input.value.trim() === pendingDelete.expected;
    btn.disabled = !ok;
    btn.classList.toggle('opacity-50', !ok);
    btn.classList.toggle('cursor-not-allowed', !ok);
  });

  btn.addEventListener('click', async () => {
    if (!pendingDelete) return;
    if (input.value.trim() !== pendingDelete.expected) {
      const errEl = document.getElementById('delete-modal-error');
      errEl.innerText = 'Teks konfirmasi tidak cocok.';
      errEl.classList.remove('hidden');
      return;
    }
    btn.disabled = true;
    btn.innerText = 'Menghapus...';
    try {
      const { type, id } = pendingDelete;
      if (type === 'lecturer') await lecturerService.deleteLecturer(id);
      else if (type === 'department') await masterDataService.deleteDepartment(id);
      else if (type === 'batch') await masterDataService.deleteBatchYear(id);
      showToast('Data berhasil dihapus.');
      closeDeleteModal();
      init();
    } catch (err) {
      showToast(`Gagal menghapus: ${err.message}`, true);
      btn.disabled = false;
      btn.innerText = 'Hapus Permanen';
    }
  });
}

// ============ DEPARTMENTS ============

function getValidDepartments() {
  return departments.filter(
    (d) =>
      d.code !== 'SETTINGS_SYS' &&
      d.$id !== 'SETTINGS_SYS' &&
      !d.code?.toUpperCase().includes('SETTINGS') &&
      !(d.name || '').trim().startsWith('{') &&
      d.faculty !== 'SYSTE'
  );
}

function renderDepartments() {
  const tbody = document.getElementById('dept-table-body');
  if (!tbody) return;

  const validDepts = getValidDepartments();

  if (validDepts.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="4" class="py-4 text-center text-muted italic">Belum ada data prodi.</td></tr>`;
  } else {
    tbody.innerHTML = validDepts
      .map(
        (d) => `
      <tr class="hover:bg-subtle/50 transition-colors">
        <td class="py-2.5 font-bold font-mono text-primary">${d.code}</td>
        <td class="py-2.5 font-medium text-default">${d.name}</td>
        <td class="py-2.5 text-muted">${d.faculty || '-'}</td>
        <td class="py-2.5 text-center whitespace-nowrap space-x-1">
          <button type="button" class="btn btn-outline-neutral text-[11px] py-0.5 px-2 rounded" onclick="editDepartment('${d.$id}')">Edit</button>
          <button type="button" class="btn btn-outline-neutral text-[11px] py-0.5 px-2 rounded text-rose-600 hover:bg-rose-50" onclick="requestDelete('department', '${d.$id}', '${(d.code || '').replace(/'/g, "\\'")}')">Hapus</button>
        </td>
      </tr>`
      )
      .join('');
  }

  // Sync dengan select prodi di modal dosen
  const deptSelect = document.getElementById('form-lecturer-dept');
  if (deptSelect && validDepts.length > 0) {
    const curVal = deptSelect.value;
    deptSelect.innerHTML = validDepts
      .map((d) => `<option value="${d.code}">${d.name} (${d.code})</option>`)
      .join('');
    if (curVal) deptSelect.value = curVal;
  }
}

window.openDeptModal = (dept) => {
  document.getElementById('dept-modal-title').innerText = dept ? 'Edit Program Studi' : 'Tambah Program Studi';
  document.getElementById('form-dept-id').value = dept ? dept.$id : '';
  document.getElementById('form-dept-code').value = dept ? dept.code : '';
  document.getElementById('form-dept-name').value = dept ? dept.name : '';
  document.getElementById('form-dept-faculty').value = dept ? (dept.faculty || '') : '';
  document.getElementById('form-dept-active').checked = dept ? dept.is_active !== false : true;
  document.getElementById('dept-modal').classList.remove('hidden');
};

window.closeDeptModal = () => document.getElementById('dept-modal').classList.add('hidden');

window.editDepartment = (id) => {
  const d = getValidDepartments().find((x) => x.$id === id);
  if (d) window.openDeptModal(d);
};

// ============ BATCH YEARS ============

function renderBatchYears() {
  const tbody = document.getElementById('batch-table-body');
  if (!tbody) return;

  if (batchYears.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-muted italic">Belum ada data angkatan.</td></tr>`;
    return;
  }

  tbody.innerHTML = batchYears
    .map(
      (b) => `
    <tr class="hover:bg-subtle/50 transition-colors">
      <td class="py-2.5 font-bold font-mono">${b.year}</td>
      <td class="py-2.5">${b.label || `Angkatan ${b.year}`}</td>
      <td class="py-2.5 text-center whitespace-nowrap space-x-1">
        <button type="button" class="btn btn-outline-neutral text-[11px] py-0.5 px-2 rounded" onclick="editBatchYear('${b.$id}')">Edit</button>
        <button type="button" class="btn btn-outline-neutral text-[11px] py-0.5 px-2 rounded text-rose-600 hover:bg-rose-50" onclick="requestDelete('batch', '${b.$id}', '${String(b.year).replace(/'/g, "\\'")}')">Hapus</button>
      </td>
    </tr>`
    )
    .join('');
}

window.openBatchModal = (b) => {
  document.getElementById('batch-modal-title').innerText = b ? 'Edit Angkatan' : 'Tambah Angkatan';
  document.getElementById('form-batch-id').value = b ? b.$id : '';
  document.getElementById('form-batch-year').value = b ? b.year : '';
  document.getElementById('form-batch-label').value = b ? (b.label || '') : '';
  document.getElementById('form-batch-active').checked = b ? b.is_active !== false : true;
  document.getElementById('batch-modal').classList.remove('hidden');
};

window.closeBatchModal = () => document.getElementById('batch-modal').classList.add('hidden');

window.editBatchYear = (id) => {
  const b = batchYears.find((x) => x.$id === id);
  if (b) window.openBatchModal(b);
};

// ============ SETTINGS & PREREQUISITES SELECTOR ============

// Mata kuliah umum UNMUHA (universitas muhammadiyah aceh) — dasar untuk prasyarat skripsi
const DEFAULT_CURRICULUM_COURSES = [
  'Pendidikan Agama Islam',
  'Pancasila',
  'Kewarganegaraan',
  'Bahasa Indonesia dan Penulisan Ilmiah',
  'Bahasa Inggris',
  'Kemuhammadiyahan',
  'AIK (Al Islam dan Kemuhammadiyahan)',
  'Metodologi Penelitian Kuantitatif',
  'Metodologi Penelitian Kualitatif',
  'Statistika',
  'Statistika Psikologi',
  'Kerja Praktek (KP)',
  'Praktek Profesi (PP)',
  'Kuliah Kerja Nyata (KKN)',
  'Stadium General',
  'Manajemen Proyek',
  'Kewirausahaan',
  'Etika Profesi',
  'Filsafat Ilmu dan Logika',
  'Pengantar Manajemen Bencana',
  'Manajemen Konstruksi',
  'Perencanaan Struktur',
  'Teknologi Bahan',
  'Kesehatan Masyarakat',
  'Gizi Masyarakat',
  'Ilmu Perilaku dan Promosi Kesehatan',
  'Psikologi Umum',
  'Psikologi Perkembangan',
  'Pengantar Akuntansi',
  'Pengantar Manajemen',
  'Pengantar Bisnis Digital',
  'Dasar-Dasar Hukum',
];

let availableCourses = [...DEFAULT_CURRICULUM_COURSES];
let selectedCourses = new Set();

function renderCourseSelector() {
  const container = document.getElementById('course-selector-container');
  const badge = document.getElementById('selected-courses-badge');
  if (!container) return;

  if (badge) {
    badge.innerText = `${selectedCourses.size} Dipilih`;
  }

  container.innerHTML = availableCourses
    .map((course) => {
      const isChecked = selectedCourses.has(course);
      return `
      <label class="flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
        isChecked
          ? 'border-primary/40 bg-primary/5 text-default'
          : 'border-default bg-default text-muted hover:bg-subtle'
      }">
        <div class="flex items-center gap-2.5">
          <input
            type="checkbox"
            class="size-3.5 accent-primary course-req-checkbox cursor-pointer"
            value="${course}"
            ${isChecked ? 'checked' : ''}
          />
          <span class="text-xs ${isChecked ? 'text-primary font-bold' : 'font-medium'}">${course}</span>
        </div>
        ${
          isChecked
            ? `<span class="text-[9.5px] font-bold py-0.5 px-2 rounded-full bg-primary/10 text-primary">Wajib</span>`
            : `<span class="text-[9.5px] text-muted">Opsional</span>`
        }
      </label>
    `;
    })
    .join('');

  container.querySelectorAll('.course-req-checkbox').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const val = e.target.value;
      if (e.target.checked) {
        selectedCourses.add(val);
      } else {
        selectedCourses.delete(val);
      }
      renderCourseSelector();
    });
  });
}

function toDateInput(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function fillSettingsForm(settings) {
  const activeEl = document.getElementById('setting-is-active');
  const yearEl = document.getElementById('setting-academic-year');
  const startEl = document.getElementById('setting-start-date');
  const endEl = document.getElementById('setting-end-date');
  const minSksEl = document.getElementById('setting-min-sks');
  const countEl = document.getElementById('setting-required-title-count');

  if (activeEl) activeEl.checked = settings.is_active !== false;
  if (yearEl) yearEl.value = settings.academic_year || '';
  if (startEl) startEl.value = toDateInput(settings.start_date);
  if (endEl) endEl.value = toDateInput(settings.end_date);
  if (minSksEl) minSksEl.value = typeof settings.min_sks === 'number' ? settings.min_sks : 100;
  if (countEl) countEl.value = typeof settings.required_title_count === 'number' ? settings.required_title_count : 3;

  if (Array.isArray(settings.required_courses)) {
    selectedCourses = new Set(settings.required_courses);
    settings.required_courses.forEach((c) => {
      if (!availableCourses.includes(c)) {
        availableCourses.push(c);
      }
    });
  } else {
    selectedCourses = new Set();
  }

  renderCourseSelector();
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  setupDeleteModal();

  // Handle direct hash navigation to tab (e.g. admin.html#settings)
  if (window.location.hash) {
    const tab = window.location.hash.replace('#', '');
    const btn = document.querySelector(`button[onclick*="'${tab}'"]`);
    if (btn) {
      window.switchAdminTab(tab, btn);
    }
  }

  const searchInput = document.getElementById('search-lecturer');
  if (searchInput) {
    searchInput.addEventListener('input', () => { clearTimeout(searchInput._debounce); searchInput._debounce = setTimeout(renderLecturersTable, 200); });
  }

  const addBtn = document.getElementById('btn-add-lecturer');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      document.getElementById('lecturer-modal-title').innerText = 'Tambah Dosen Baru';
      document.getElementById('form-lecturer-id').value = '';
      document.getElementById('form-lecturer-nip').value = '';
      document.getElementById('form-lecturer-name').value = '';
      document.getElementById('form-lecturer-email').value = '';
      document.getElementById('form-lecturer-quota').value = 10;
      document.getElementById('form-lecturer-expertise').value = '';
      document.getElementById('form-lecturer-role').value = 'lecturer';
      document.getElementById('lecturer-modal').classList.remove('hidden');
    });
  }

  const form = document.getElementById('lecturer-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('form-lecturer-id').value;
      const nip = document.getElementById('form-lecturer-nip').value.trim();
      const name = document.getElementById('form-lecturer-name').value.trim();
      const email = document.getElementById('form-lecturer-email').value.trim();
      const dept = document.getElementById('form-lecturer-dept').value;
      const quota = parseInt(document.getElementById('form-lecturer-quota').value, 10) || 10;
      const expertise = document.getElementById('form-lecturer-expertise').value.trim();
      const role = document.getElementById('form-lecturer-role').value;

      const saveBtn = document.getElementById('btn-save-lecturer');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = 'Menyimpan...';
      }

      try {
        if (id) {
          await lecturerService.updateLecturer(id, {
            nip,
            name,
            email,
            department_id: dept,
            quota,
            expertise,
            role,
          });
          showToast('Data dosen berhasil diperbarui.');
        } else {
          await lecturerService.createLecturer({
            nip,
            name,
            email,
            department_id: dept,
            quota,
            current_students: 0,
            expertise,
            role,
            is_active: true,
          });
          showToast('Dosen baru berhasil ditambahkan.');
        }

        closeLecturerModal();
        init();
      } catch (err) {
        showToast(`Gagal menyimpan: ${err.message}`, true);
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerText = 'Simpan Data Dosen';
        }
      }
    });
  }

  // ---- Dept form ----
  const deptForm = document.getElementById('dept-form');
  if (deptForm) {
    deptForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('form-dept-id').value;
      const code = document.getElementById('form-dept-code').value.trim().toUpperCase();
      const name = document.getElementById('form-dept-name').value.trim();
      const faculty = document.getElementById('form-dept-faculty').value.trim();
      const is_active = document.getElementById('form-dept-active').checked;
      try {
        if (id) {
          await masterDataService.updateDepartment(id, { code, name, faculty, is_active });
          showToast('Program studi diperbarui.');
        } else {
          await masterDataService.createDepartment({ code, name, faculty, is_active });
          showToast('Program studi ditambahkan.');
        }
        closeDeptModal();
        init();
      } catch (err) {
        showToast(`Gagal menyimpan prodi: ${err.message}`, true);
      }
    });
  }

  const btnAddDept = document.getElementById('btn-add-dept');
  if (btnAddDept) btnAddDept.addEventListener('click', () => window.openDeptModal(null));

  // ---- Batch form ----
  const batchForm = document.getElementById('batch-form');
  if (batchForm) {
    batchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('form-batch-id').value;
      const year = parseInt(document.getElementById('form-batch-year').value, 10);
      const label = document.getElementById('form-batch-label').value.trim();
      const is_active = document.getElementById('form-batch-active').checked;
      if (!year) return;
      try {
        if (id) {
          await masterDataService.updateBatchYear(id, { year, label, is_active });
          showToast('Angkatan diperbarui.');
        } else {
          await masterDataService.createBatchYear({ year, label, is_active });
          showToast('Angkatan ditambahkan.');
        }
        closeBatchModal();
        init();
      } catch (err) {
        showToast(`Gagal menyimpan angkatan: ${err.message}`, true);
      }
    });
  }

  const btnAddBatch = document.getElementById('btn-add-batch');
  if (btnAddBatch) btnAddBatch.addEventListener('click', () => window.openBatchModal(null));

  // ---- Prerequisite Course Add Handler ----
  const btnAddCourse = document.getElementById('btn-add-course');
  const inputNewCourse = document.getElementById('input-new-course');

  function handleAddCustomCourse() {
    if (!inputNewCourse) return;
    const val = inputNewCourse.value.trim();
    if (!val) return;
    if (!availableCourses.includes(val)) {
      availableCourses.push(val);
    }
    selectedCourses.add(val);
    inputNewCourse.value = '';
    renderCourseSelector();
    showToast(`Mata kuliah "${val}" ditambahkan ke syarat wajib.`);
  }

  if (btnAddCourse) btnAddCourse.addEventListener('click', handleAddCustomCourse);
  if (inputNewCourse) {
    inputNewCourse.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddCustomCourse();
      }
    });
  }

  // ---- Settings Save Handler ----
  const saveSettingsBtn = document.getElementById('btn-save-settings');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async () => {
      const coursesArr = Array.from(selectedCourses);
      const minSksVal = parseInt(document.getElementById('setting-min-sks')?.value, 10);
      const titleCountVal = parseInt(
        document.getElementById('setting-required-title-count')?.value,
        10
      );

      const payload = {
        is_active: document.getElementById('setting-is-active')?.checked !== false,
        academic_year: document.getElementById('setting-academic-year')?.value.trim() || '',
        start_date: document.getElementById('setting-start-date')?.value || '',
        end_date: document.getElementById('setting-end-date')?.value || '',
        min_sks: isNaN(minSksVal) ? 100 : minSksVal,
        required_title_count: isNaN(titleCountVal) ? 3 : titleCountVal,
        required_courses: coursesArr,
      };
      saveSettingsBtn.disabled = true;
      saveSettingsBtn.innerText = 'Menyimpan...';
      try {
        await settingsService.updateSettings(payload);
        showToast('Konfigurasi sistem & prasyarat matkul berhasil disimpan!');
      } catch (err) {
        showToast(`Gagal menyimpan pengaturan: ${err.message}`, true);
      } finally {
        saveSettingsBtn.disabled = false;
        saveSettingsBtn.innerText = 'Simpan Konfigurasi Sistem';
      }
    });
  }
});
