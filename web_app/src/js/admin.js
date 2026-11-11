import { lecturerService, masterDataService, authService } from './spsm.js';

let lecturers = [];
let departments = [];
let batchYears = [];

async function init() {
  try {
    const [lecList, deptList, batchList] = await Promise.all([
      lecturerService.getLecturers(),
      masterDataService.getDepartments(),
      masterDataService.getBatchYears(),
    ]);

    lecturers = lecList;
    departments = deptList;
    batchYears = batchList;

    renderLecturersTable();
    renderDepartments();
    renderBatchYears();
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
          <span class="badge badge-neutral text-xs px-2 py-0.5">${lec.department_id || 'TI'}</span>
          <div class="text-[11px] text-muted mt-0.5 line-clamp-1">${lec.expertise || '-'}</div>
        </td>
        <td class="py-3 px-4">
          <div class="relative min-w-[160px]">
            <select
              class="form-select w-full text-xs font-semibold h-8 ps-2.5 pe-8 bg-default border border-default rounded-lg text-default hover:border-primary focus:border-primary cursor-pointer shadow-2xs transition"
              onchange="changeLecturerRole('${lec.$id}', this.value)"
            >
              <option value="lecturer" ${lec.role === 'lecturer' ? 'selected' : ''}>📘 Dosen Pembimbing</option>
              <option value="reviewer" ${lec.role === 'reviewer' ? 'selected' : ''}>🔍 Dosen Penilai</option>
              <option value="kaprodi" ${lec.role === 'kaprodi' ? 'selected' : ''}>⭐ Ketua Prodi</option>
              <option value="admin" ${lec.role === 'admin' ? 'selected' : ''}>🛡️ Administrator</option>
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
            onclick="editLecturer(${idx})"
          >
            Edit
          </button>
          <button
            type="button"
            class="btn btn-outline-neutral text-xs py-1 px-2 text-rose-600 hover:bg-rose-50 rounded-lg"
            onclick="deleteLecturer('${lec.$id}', '${lec.name}')"
          >
            Hapus
          </button>
        </td>
      </tr>`;
    })
    .join('');

  window.activeLecturerList = filtered;
}

window.changeLecturerRole = async (lecturerId, newRole) => {
  try {
    await lecturerService.updateRole(lecturerId, newRole);
    showToast('Hak akses peran dosen berhasil diperbarui!');
  } catch (err) {
    showToast(`Gagal mengubah peran: ${err.message}`, true);
  }
};

window.editLecturer = (idx) => {
  const lec = window.activeLecturerList ? window.activeLecturerList[idx] : null;
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

window.deleteLecturer = async (id, name) => {
  if (!confirm(`Apakah Anda yakin ingin menghapus dosen "${name}"?`)) return;
  try {
    await lecturerService.deleteLecturer(id);
    showToast(`Dosen "${name}" berhasil dihapus.`);
    init();
  } catch (err) {
    showToast(`Gagal menghapus: ${err.message}`, true);
  }
};

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
      <tr><td class="py-2.5 font-bold font-mono">TI</td><td>Teknik Informatika</td><td class="text-muted">Teknik</td></tr>
      <tr><td class="py-2.5 font-bold font-mono">BD</td><td>Bisnis Digital</td><td class="text-muted">Ekonomi & Bisnis</td></tr>
      <tr><td class="py-2.5 font-bold font-mono">SI</td><td>Sistem Informasi</td><td class="text-muted">Teknik</td></tr>`;
    return;
  }

  tbody.innerHTML = validDepts
    .map(
      (d) => `
    <tr class="hover:bg-subtle/50 transition-colors">
      <td class="py-2.5 font-bold font-mono text-primary">${d.code}</td>
      <td class="py-2.5 font-medium text-default">${d.name}</td>
      <td class="py-2.5 text-muted">${d.faculty || '-'}</td>
    </tr>`
    )
    .join('');

  // Sync with lecturer modal department select
  const deptSelect = document.getElementById('form-lecturer-dept');
  if (deptSelect && validDepts.length > 0) {
    const curVal = deptSelect.value;
    deptSelect.innerHTML = validDepts
      .map((d) => `<option value="${d.code}">${d.name} (${d.code})</option>`)
      .join('');
    if (curVal) deptSelect.value = curVal;
  }
}

function renderBatchYears() {
  const tbody = document.getElementById('batch-table-body');
  if (!tbody) return;

  if (batchYears.length === 0) {
    tbody.innerHTML = `
      <tr><td class="py-2.5 font-bold font-mono">2026</td><td>Angkatan 2026 (Gen 23)</td></tr>
      <tr><td class="py-2.5 font-bold font-mono">2025</td><td>Angkatan 2025 (Gen 22)</td></tr>
      <tr><td class="py-2.5 font-bold font-mono">2024</td><td>Angkatan 2024 (Gen 21)</td></tr>`;
    return;
  }

  tbody.innerHTML = batchYears
    .map(
      (b) => `
    <tr>
      <td class="py-2.5 font-bold font-mono">${b.year}</td>
      <td class="py-2.5">${b.label || `Angkatan ${b.year}`}</td>
    </tr>`
    )
    .join('');
}

document.addEventListener('DOMContentLoaded', () => {
  init();

  const searchInput = document.getElementById('search-lecturer');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderLecturersTable());
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

  const saveSettingsBtn = document.getElementById('btn-save-settings');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      showToast('Pengaturan masa pendaftaran berhasil disimpan.');
    });
  }
});
