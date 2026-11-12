import { submissionService, formatDateShort, statusNorm } from './spsm.js';

let allSubmissions = null;

async function loadDashboard() {
  const tableBody = document.getElementById('submissions-table-body');
  const counterEl = document.getElementById('record-counter');

  try {
    const submissions = await submissionService.getAllSubmissions();
    allSubmissions = submissions;

    // Calculate metrics
    const total = submissions.length;
    const pending = submissions.filter((s) => s.status === 'pending_lecturer').length;
    const waiting = submissions.filter((s) => s.status === 'waiting_kaprodi').length;
    const approved = submissions.filter((s) => s.status === 'approved' || s.status === 'sk_issued').length;

    // Set stat cards
    const totalEl = document.getElementById('stat-total-submissions');
    const pendEl = document.getElementById('stat-pending-submissions');
    const waitEl = document.getElementById('stat-waiting-kaprodi');
    const appEl = document.getElementById('stat-approved-submissions');

    if (totalEl) totalEl.innerText = total;
    if (pendEl) pendEl.innerText = pending;
    if (waitEl) waitEl.innerText = waiting;
    if (appEl) appEl.innerText = approved;

    renderTable();
  } catch (err) {
    console.error('loadDashboard failed:', err);
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-red-600 font-medium">Gagal memuat data pengajuan: ${err.message || err}</td></tr>`;
    }
  }
}

function renderTable() {
  const tableBody = document.getElementById('submissions-table-body');
if (allSubmissions === null) {
    tableBody.innerHTML = Array.from({ length: 5 }, () =>
      '<tr><td colspan="6" class="py-2 px-4"><div class="h-9 bg-slate-100 rounded-lg animate-pulse"></div></td></tr>'
    ).join('');
    return;
  }
    const counterEl = document.getElementById('record-counter');
  const searchInput = document.getElementById('search-input');
  const filterSelect = document.getElementById('filter-status');

  const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const filterStatus = filterSelect ? filterSelect.value : 'all';

  const filtered = allSubmissions.filter((sub) => {
    if (filterStatus !== 'all' && statusNorm(sub.status) !== statusNorm(filterStatus)) return false;
    if (!q) return true;

    const studentName = sub.student?.name?.toLowerCase() || '';
    const studentNim = sub.student?.nim_or_nip?.toLowerCase() || '';
    const title =
      sub.options?.find((o) => o.is_selected || o.is_selected_by_lecturer)?.title?.toLowerCase() ||
      sub.options?.[0]?.title?.toLowerCase() ||
      '';

    return studentName.includes(q) || studentNim.includes(q) || title.includes(q);
  });

  if (counterEl) {
    counterEl.innerText = `Menampilkan ${filtered.length} dari ${allSubmissions.length} pengajuan`;
  }

  if (!tableBody) return;

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="py-10 text-center text-muted italic">
          Tidak ada data pengajuan skripsi yang cocok dengan kriteria filter.
        </td>
      </tr>`;
    return;
  }

  const statusBadges = {
    drafting: { label: 'Draft', cls: 'bg-slate-100 text-slate-800 border-slate-300' },
    pending_lecturer: { label: 'Menunggu Review', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
    waiting_kaprodi: { label: 'Pleno Kaprodi', cls: 'bg-blue-100 text-blue-900 border-blue-300' },
    waiting_akademik: { label: 'Menunggu Administrasi TU', cls: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
    sk_process: { label: 'Proses TTD Dekan', cls: 'bg-orange-100 text-orange-900 border-orange-300' },
    sk_issued: { label: 'SK Resmi Terbit', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
    approved: { label: 'SK Resmi Terbit', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
    revision: { label: 'Perlu Revisi', cls: 'bg-orange-100 text-orange-900 border-orange-300' },
    rejected: { label: 'Ditolak', cls: 'bg-red-100 text-red-900 border-red-300' },
  };

  tableBody.innerHTML = filtered
    .map((sub, idx) => {
      const student = sub.student;
      const chosenOpt = sub.options?.find((o) => o.is_selected_by_lecturer) || sub.options?.[0];
      const statusBadge = statusBadges[statusNorm(sub.status)] || statusBadges[sub.status] || { label: String(sub.status || '').replace(/_/g, ' '), cls: 'bg-slate-100 text-slate-800' };

      return `
      <tr class="hover:bg-subtle/80 transition-colors">
        <td class="py-3 px-4">
          <div class="font-bold text-default">${student?.name || 'Mahasiswa'}</div>
          <div class="font-mono text-muted text-[11px] mt-0.5">${student?.nim_or_nip || sub.student_id}</div>
        </td>
        <td class="py-3 px-4">
          <span class="badge badge-neutral text-xs px-2 py-0.5">${student?.department || '-'}</span>
          <div class="text-[11px] text-muted mt-0.5">Letting ${student?.batch_year || 2026}</div>
        </td>
        <td class="py-3 px-4 max-w-sm">
          <div class="text-[10px] font-bold text-primary mb-0.5">Opsi ${chosenOpt?.option_number || 1}</div>
          <div class="font-medium text-default line-clamp-2 text-xs leading-snug">${chosenOpt?.title || '(Belum ada judul)'}</div>
        </td>
        <td class="py-3 px-4 whitespace-nowrap">
          <span class="badge text-xs px-2.5 py-0.5 font-bold border ${statusBadge.cls}">
            ${statusBadge.label}
          </span>
          ${
            statusNorm(sub.status) === 'sk_issued' && sub.nomor_surat
              ? `<div class="font-mono text-[10px] font-bold text-emerald-700 mt-1">${sub.nomor_surat}</div>`
              : ''
          }
        </td>
        <td class="py-3 px-4">
          ${
            sub.advisor
              ? `
            <div class="space-y-0.5">
              <div class="font-semibold text-default text-[11px]">1. ${sub.advisor.name}</div>
              ${sub.advisor2 ? `<div class="text-muted text-[11px]">2. ${sub.advisor2.name}</div>` : ''}
            </div>`
              : `<span class="text-muted italic text-[11px]">Belum diplot</span>`
          }
        </td>
        <td class="py-3 px-4 text-center whitespace-nowrap">
          <button
            type="button"
            class="btn btn-outline-neutral text-xs font-semibold py-1.5 px-3 rounded-lg hover:border-primary hover:text-primary cursor-pointer"
            data-index="${idx}"
          >
            Lihat Berkas
          </button>
        </td>
      </tr>`;
    })
    .join('');

  // Attach click listeners to open dossier
  tableBody.querySelectorAll('button[data-index]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.getAttribute('data-index'), 10);
      const sub = filtered[index];
      if (sub && window.openDossierModal) {
        window.openDossierModal(sub);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => { clearTimeout(searchInput._debounce); searchInput._debounce = setTimeout(renderTable, 200); });
  }

  const filterSelect = document.getElementById('filter-status');
  if (filterSelect) {
    filterSelect.addEventListener('change', () => renderTable());
  }
});
