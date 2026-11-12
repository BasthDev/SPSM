import { submissionService, lecturerService, authService, formatDateShort, statusNorm } from './spsm.js';

let submissions = null;
let lecturers = [];
let currentLecturerId = null;
let isAdmin = false;
let selectedAdvisorId = 'all';

async function init() {
  try {
    const auth = await authService.getCurrentUser();
    if (!auth) return;

    isAdmin = auth.isAdmin;
    currentLecturerId = auth.lecturer?.$id || null;

    const [subList, lecList] = await Promise.all([
      submissionService.getAllSubmissions(),
      lecturerService.getLecturers(),
    ]);

    // Keep only approved/issued/in-process SK submissions for advisor view
    submissions = subList.filter((s) =>
      ['sk_issued', 'approved', 'sk_process', 'waiting_akademik'].includes(statusNorm(s.status))
    );
    lecturers = lecList;

    if (!isAdmin && currentLecturerId) {
      selectedAdvisorId = currentLecturerId;
      const titleEl = document.getElementById('advisor-portal-title');
      if (titleEl) {
        titleEl.innerText = `Portal Bimbingan — ${auth.lecturer?.name || 'Dosen'}`;
      }
    } else if (isAdmin) {
      const picker = document.getElementById('admin-advisor-picker');
      if (picker) {
        picker.classList.remove('hidden');
        picker.classList.add('flex');
      }
      setupAdminAdvisorPicker();
    }

    updateMetricsAndTable();
  } catch (err) {
    console.error('Advisor init failed:', err);
  }
}

function setupAdminAdvisorPicker() {
  const select = document.getElementById('select-advisor-filter');
  if (!select) return;

  select.innerHTML =
    `<option value="all">Semua Dosen Pembimbing</option>` +
    lecturers
      .map((l) => `<option value="${l.$id}">${l.name} (${l.current_students || 0}/${l.quota} mhs)</option>`)
      .join('');

  select.addEventListener('change', () => {
    selectedAdvisorId = select.value;
    updateMetricsAndTable();
  });
}

function updateMetricsAndTable() {
  const tbody = document.getElementById('advisor-table-body');
  if (submissions === null && tbody) {
    tbody.innerHTML = Array.from({ length: 5 }, () => '<tr><td colspan="6" class="py-2 px-4"><div class="h-9 bg-slate-100 rounded-lg animate-pulse"></div></td></tr>').join('');
    return;
  }
  const targetId = !isAdmin && currentLecturerId ? currentLecturerId : selectedAdvisorId;

  const lecData = lecturers.find((l) => l.$id === targetId);

  // Filter approved submissions matching advisor
  const filtered = submissions.filter((s) => {
    if (targetId && targetId !== 'all') {
      const parts = [
        s.advisor_1_id,
        s.advisor_2_id,
        ...(s.advisor_id ? s.advisor_id.split(',') : []),
      ].filter(Boolean).map((p) => p.trim());
      if (!parts.includes(targetId)) return false;
    }
    return true;
  });

  const activeCount = filtered.length;
  const maxQuota = lecData ? lecData.quota : 10;
  const remaining = Math.max(0, maxQuota - activeCount);

  document.getElementById('metric-adv-active').innerText = activeCount;
  document.getElementById('metric-adv-quota').innerText = maxQuota;
  document.getElementById('metric-adv-remaining').innerText = remaining;
  document.getElementById('metric-adv-dept').innerText = lecData?.department_id || 'TI';

  renderTable(filtered);
}

function renderTable(list) {
  const tbody = document.getElementById('advisor-table-body');
  const counterEl = document.getElementById('advisor-counter');
  const searchInput = document.getElementById('advisor-search');
  const q = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const searched = list.filter((s) => {
    if (!q) return true;
    const name = s.student?.name?.toLowerCase() || '';
    const nim = s.student?.nim_or_nip?.toLowerCase() || '';
    const title =
      s.options?.find((o) => o.is_selected_by_lecturer)?.title?.toLowerCase() ||
      s.options?.[0]?.title?.toLowerCase() ||
      '';
    return name.includes(q) || nim.includes(q) || title.includes(q);
  });

  if (counterEl) {
    counterEl.innerText = `Total: ${searched.length} mahasiswa bimbingan`;
  }

  if (!tbody) return;

  if (searched.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-muted italic">Tidak ada mahasiswa bimbingan ditemukan.</td></tr>`;
    return;
  }

  tbody.innerHTML = searched
    .map((sub, idx) => {
      const student = sub.student;
      const chosenOpt = sub.options?.find((o) => o.is_selected_by_lecturer) || sub.options?.[0];

      return `
      <tr class="hover:bg-subtle/80 transition-colors">
        <td class="py-3 px-4">
          <div class="font-bold text-default">${student?.name || 'Mahasiswa'}</div>
          <div class="font-mono text-muted text-[11px]">${student?.nim_or_nip || sub.student_id}</div>
        </td>
        <td class="py-3 px-4">
          <span class="badge badge-neutral text-xs px-2 py-0.5">${student?.department || '-'}</span>
          <div class="text-[11px] text-muted mt-0.5">Letting ${student?.batch_year || 2026}</div>
        </td>
        <td class="py-3 px-4 max-w-sm">
          <div class="font-bold text-default text-xs line-clamp-2 leading-snug">${chosenOpt?.title || '(Judul Skripsi)'}</div>
          <div class="text-[10px] text-primary font-semibold mt-0.5">Opsi ${chosenOpt?.option_number || 1} Terpilih</div>
        </td>
        <td class="py-3 px-4 whitespace-nowrap">
          <span class="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            ${sub.nomor_surat || 'Nomor SK Aktif'}
          </span>
        </td>
        <td class="py-3 px-4 text-xs font-mono text-muted whitespace-nowrap">
          ${formatDateShort(sub.sk_generated_at || sub.submitted_at || sub.$createdAt)}
        </td>
        <td class="py-3 px-4 text-center whitespace-nowrap">
          <button
            type="button"
            class="btn btn-outline-neutral text-xs font-semibold py-1.5 px-3 rounded-lg hover:border-primary hover:text-primary cursor-pointer"
            onclick="viewDossierAdvisor(${idx})"
          >
            Lihat Berkas
          </button>
        </td>
      </tr>`;
    })
    .join('');

  window.activeAdvisorList = searched;
}

window.viewDossierAdvisor = (idx) => {
  const sub = window.activeAdvisorList ? window.activeAdvisorList[idx] : null;
  if (sub && window.openDossierModal) {
    window.openDossierModal(sub);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  init();

  const searchInput = document.getElementById('advisor-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => { clearTimeout(searchInput._debounce); searchInput._debounce = setTimeout(updateMetricsAndTable, 200); });
  }
});
