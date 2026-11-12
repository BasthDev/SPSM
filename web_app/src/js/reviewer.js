import { submissionService, lecturerService, authService, statusNorm } from './spsm.js';

let submissions = null;
let lecturers = [];
let currentFilter = 'pending_lecturer';
let selectedSubmission = null;
let currentUserName = 'Dosen Penilai';
let lastFiltered = []; // referensi array terfilter terakhir untuk indexing btn onclick

async function init() {
  try {
    const auth = await authService.getCurrentUser();
    if (auth) {
      currentUserName = auth.lecturer?.name || auth.profile?.name || auth.account?.name || 'Dosen Penilai';
    }

    const [subList, lecList] = await Promise.all([
      submissionService.getAllSubmissions(),
      lecturerService.getLecturers(),
    ]);

    submissions = subList;
    lecturers = lecList;

    updateMetrics();
    renderTable();
    setupAdvisorDropdowns();
  } catch (err) {
    console.error('Reviewer init failed:', err);
  }
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast-feedback');
  if (!toast) return;
  toast.innerText = message;
  toast.className = `py-2 px-4 rounded-lg text-xs font-bold ${
    isError ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
  }`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4000);
}

function updateMetrics() {
  const pending = submissions.filter((s) => statusNorm(s.status) === 'pending_lecturer').length;
  const waiting = submissions.filter((s) => statusNorm(s.status) === 'waiting_kaprodi').length;
  const approved = submissions.filter((s) => statusNorm(s.status) === 'sk_issued').length;
  const revisions = submissions.filter((s) => ['revision', 'rejected'].includes(statusNorm(s.status))).length;

  document.getElementById('metric-pending').innerText = pending;
  document.getElementById('metric-waiting').innerText = waiting;
  document.getElementById('metric-approved').innerText = approved;
  document.getElementById('metric-revisions').innerText = revisions;

  document.getElementById('count-pending').innerText = pending;
  document.getElementById('count-waiting').innerText = waiting;
  document.getElementById('count-approved').innerText = approved;
  document.getElementById('count-all').innerText = submissions.length;
}

function renderTable() {
  const tbody = document.getElementById('reviewer-table-body');
if (submissions === null) {
    tbody.innerHTML = Array.from({ length: 5 }, () =>
      '<tr><td colspan="6" class="py-2 px-4"><div class="h-9 bg-slate-100 rounded-lg animate-pulse"></div></td></tr>'
    ).join('');
    return;
  }
    const searchInput = document.getElementById('reviewer-search');
  const q = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const wantStatus = currentFilter === 'approved' ? 'sk_issued' : currentFilter;
  const filtered = submissions.filter((s) => {
    if (currentFilter !== 'all' && statusNorm(s.status) !== wantStatus) return false;
    if (!q) return true;
    const name = s.student?.name?.toLowerCase() || '';
    const nim = s.student?.nim_or_nip?.toLowerCase() || '';
    const title =
      s.options?.find((o) => o.is_selected_by_lecturer)?.title?.toLowerCase() ||
      s.options?.[0]?.title?.toLowerCase() ||
      '';
    return name.includes(q) || nim.includes(q) || title.includes(q);
  });

  if (!tbody) return;

  lastFiltered = filtered;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-muted italic">Tidak ada proposal pada filter ini.</td></tr>`;
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

  tbody.innerHTML = filtered
    .map((sub, idx) => {
      const student = sub.student;
      const chosenOpt = sub.options?.find((o) => o.is_selected_by_lecturer) || sub.options?.[0];
      const statusBadge = statusBadges[statusNorm(sub.status)] || statusBadges[sub.status] || { label: String(sub.status || '').replace(/_/g, ' '), cls: 'bg-slate-100 text-slate-800' };

      return `
      <tr class="hover:bg-subtle/80 transition-colors">
        <td class="py-3 px-4">
          <div class="font-bold text-default">${student?.name || 'Mahasiswa'}</div>
          <div class="font-mono text-muted text-[11px]">${student?.nim_or_nip || sub.student_id}</div>
        </td>
        <td class="py-3 px-4">
          <span class="badge badge-neutral text-xs px-2 py-0.5">${student?.department || 'TI'}</span>
          <div class="text-[11px] text-muted mt-0.5">Letting ${student?.batch_year || 2026}</div>
        </td>
        <td class="py-3 px-4 max-w-sm">
          <div class="font-medium text-default line-clamp-2 text-xs">${chosenOpt?.title || '(Belum ada judul)'}</div>
          <div class="text-[11px] text-muted mt-0.5">${sub.options?.length || 0} opsi diajukan</div>
        </td>
        <td class="py-3 px-4 whitespace-nowrap">
          <span class="badge text-xs px-2.5 py-0.5 font-bold border ${statusBadge.cls}">${statusBadge.label}</span>
          ${statusNorm(sub.status) === 'sk_issued' && sub.nomor_surat ? `<div class="font-mono text-[10px] font-bold text-emerald-700 mt-0.5">${sub.nomor_surat}</div>` : ''}
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
        <td class="py-3 px-4 text-center whitespace-nowrap space-x-1.5">
          <button
            type="button"
            class="btn btn-outline-neutral text-xs py-1.5 px-2.5 rounded-lg"
            onclick="viewDossier(${idx})"
          >
            Berkas
          </button>
          <button
            type="button"
            class="btn btn-primary text-xs font-bold py-1.5 px-3 rounded-lg"
            onclick="openReviewDrawer(${idx})"
          >
            Evaluasi
          </button>
        </td>
      </tr>`;
    })
    .join('');
}

window.viewDossier = (idx) => {
  const sub = lastFiltered[idx];
  if (sub && window.openDossierModal) {
    window.openDossierModal(sub);
  }
};

window.openReviewDrawer = (idx) => {
  const sub = lastFiltered[idx];
  if (!sub) return;
  selectedSubmission = sub;

  document.getElementById('review-modal-student-info').innerText = `${sub.student?.name || 'Mahasiswa'} • NIM: ${
    sub.student?.nim_or_nip || sub.student_id
  } • ${sub.student?.department || 'TI'}`;

  // Populate options
  const container = document.getElementById('review-options-container');
  if (container) {
    const selectedOpt = sub.options?.find((o) => o.is_selected_by_lecturer);
    const selectedId = selectedOpt?.$id || sub.options?.[0]?.$id;

    container.innerHTML = (sub.options || [])
      .map(
        (opt) => `
      <label class="block p-3.5 rounded-xl border border-default hover:border-primary cursor-pointer transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-lighter/30 has-[:checked]:ring-1 has-[:checked]:ring-primary">
        <div class="flex items-start gap-3">
          <input type="radio" name="selected_option_id" value="${opt.$id}" class="mt-1" ${
          opt.$id === selectedId ? 'checked' : ''
        } required />
          <div class="grow space-y-1">
            <div class="flex items-center justify-between">
              <span class="badge badge-primary text-[10px] font-bold px-2 py-0.5">Opsi ${opt.option_number}</span>
              ${
                opt.journal_file_id
                  ? `<a href="${submissionService.getFileViewUrl(
                      opt.journal_file_id
                    )}" target="_blank" class="text-xs text-primary font-bold hover:underline" onclick="event.stopPropagation()">Lihat PDF ↗</a>`
                  : ''
              }
            </div>
            <div class="text-xs font-bold text-default">${opt.title}</div>
            <div class="text-[11px] text-muted line-clamp-2">${opt.background || '-'}</div>
            ${
              opt.relevance_variable || opt.relevance_methodology || opt.relevance_note
                ? `
              <div class="mt-2 p-2 rounded bg-subtle border border-default text-[10px] space-y-0.5">
                <div><span class="font-bold text-primary">Variabel/Fokus:</span> ${opt.relevance_variable || '-'}</div>
                <div><span class="font-bold text-primary">Metodologi Jurnal:</span> ${opt.relevance_methodology || '-'}</div>
                <div><span class="font-bold text-primary">Kesesuaian:</span> ${opt.relevance_note || '-'}</div>
              </div>
            `
                : ''
            }
          </div>
        </div>
      </label>`
      )
      .join('');
  }

  // Pre-select advisors
  const adv1Select = document.getElementById('review-advisor-1');
  const adv2Select = document.getElementById('review-advisor-2');

  if (adv1Select) {
    adv1Select.value = sub.advisor?.$id || sub.preferredAdvisor1?.$id || (lecturers[0]?.$id || '');
  }
  if (adv2Select) {
    adv2Select.value = sub.advisor2?.$id || sub.preferredAdvisor2?.$id || '';
  }

  document.getElementById('review-notes').value = '';
  document.getElementById('review-action-modal').classList.remove('hidden');
};

window.closeReviewModal = () => {
  const modal = document.getElementById('review-action-modal');
  if (modal) modal.classList.add('hidden');
};

function setupAdvisorDropdowns() {
  const adv1 = document.getElementById('review-advisor-1');
  const adv2 = document.getElementById('review-advisor-2');

  const optionsHtml = lecturers
    .map(
      (lec) =>
        `<option value="${lec.$id}">${lec.name} (Kuota: ${lec.current_students || 0}/${lec.quota} mhs)</option>`
    )
    .join('');

  if (adv1) {
    adv1.innerHTML = `<option value="">Pilih Pembimbing 1 (Utama)...</option>` + optionsHtml;
  }
  if (adv2) {
    adv2.innerHTML = `<option value="">(Opsional) Pilih Pembimbing 2 (Pendamping)...</option>` + optionsHtml;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();

  // Search
  const searchInput = document.getElementById('reviewer-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => { clearTimeout(searchInput._debounce); searchInput._debounce = setTimeout(renderTable, 200); });
  }

  // Filters
  document.querySelectorAll('#filter-pill-group button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#filter-pill-group button').forEach((b) => {
        b.className = 'btn btn-outline-neutral text-xs font-semibold py-1.5 px-3 rounded-lg cursor-pointer';
      });
      btn.className = 'btn btn-primary text-xs font-bold py-1.5 px-3 rounded-lg cursor-pointer';
      currentFilter = btn.getAttribute('data-filter') || 'all';
      renderTable();
    });
  });

  // Submit Review Form
  const reviewForm = document.getElementById('review-form');
  if (reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedSubmission) return;

      const checkedOpt = document.querySelector('input[name="selected_option_id"]:checked');
      if (!checkedOpt) {
        alert('Pilih salah satu opsi judul!');
        return;
      }

      const adv1 = document.getElementById('review-advisor-1').value;
      const adv2 = document.getElementById('review-advisor-2').value;
      const notes = document.getElementById('review-notes').value.trim();

      if (!adv1) {
        alert('Dosen Pembimbing 1 wajib dipilih!');
        return;
      }
      if (adv1 && adv2 && adv1 === adv2) {
        alert('Pembimbing 1 dan Pembimbing 2 tidak boleh orang yang sama!');
        return;
      }

      const btn = document.getElementById('btn-submit-review');
      if (btn) {
        btn.disabled = true;
        btn.innerText = 'Menyimpan...';
      }

      try {
        await submissionService.reviewAndSelectTitle(
          selectedSubmission.$id,
          checkedOpt.value,
          adv1,
          adv2,
          currentUserName,
          notes
        );
        showToast('Verifikasi berhasil! Judul dan Dosen Pembimbing diteruskan ke Kaprodi.');
        closeReviewModal();
        init();
      } catch (err) {
        showToast(`Gagal memproses: ${err.message}`, true);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerText = 'Setujui & Teruskan ke Kaprodi';
        }
      }
    });
  }

  // Request Revision / Reject via modal catatan per-judul
  const btnRevision = document.getElementById('btn-request-revision');
  if (btnRevision) {
    btnRevision.addEventListener('click', () => openDecisionModal('revisi'));
  }

  const btnReject = document.getElementById('btn-reject-submission');
  if (btnReject) {
    btnReject.addEventListener('click', () => openDecisionModal('tolak'));
  }

  const btnConfirmDecision = document.getElementById('btn-confirm-decision');
  if (btnConfirmDecision) {
    btnConfirmDecision.addEventListener('click', async () => {
      if (!selectedSubmission || !pendingDecisionType) return;

      const notes = collectDecisionNotes();
      const hasAnyNote = notes.opt1 || notes.opt2 || notes.opt3 || notes.general;
      if (!hasAnyNote) {
        alert('Isi minimal satu catatan evaluasi!');
        return;
      }

      btnConfirmDecision.disabled = true;
      btnConfirmDecision.innerText = 'Mengirim...';
      try {
        const advisorId = selectedSubmission.advisor_id || '';
        if (pendingDecisionType === 'revisi') {
          await submissionService.requestRevision(selectedSubmission.$id, currentUserName, notes);
          showToast('Status berhasil diubah menjadi Perlu Revisi.');
        } else {
          await submissionService.rejectSubmission(selectedSubmission.$id, currentUserName, notes, advisorId);
          showToast('Proposal resmi ditolak.');
        }
        closeDecisionModal();
        closeReviewModal();
        init();
      } catch (err) {
        showToast(`Gagal: ${err.message}`, true);
      } finally {
        btnConfirmDecision.disabled = false;
        btnConfirmDecision.innerText = 'Kirim Keputusan';
      }
    });
  }
});

// ============ Decision Modal (catatan per opsi judul) ============

let pendingDecisionType = null; // 'revisi' | 'tolak'

function openDecisionModal(type) {
  if (!selectedSubmission) return;
  pendingDecisionType = type;

  const isRevision = type === 'revisi';
  document.getElementById('decision-modal-title').innerText = isRevision
    ? 'Catatan Permintaan Revisi per Judul'
    : 'Catatan Penolakan per Judul';
  document.getElementById('decision-modal-subhead').innerText =
    `${selectedSubmission.student?.name || 'Mahasiswa'} • ${selectedSubmission.options?.length || 0} opsi judul`;

  const container = document.getElementById('decision-options-container');
  const options = [...(selectedSubmission.options || [])].sort(
    (a, b) => (a.option_number || 0) - (b.option_number || 0)
  );

  container.innerHTML = options
    .map(
      (opt, i) => `
    <div class="p-3 rounded-xl border border-default bg-subtle space-y-1.5">
      <div class="text-xs font-bold text-default">Opsi ${opt.option_number ?? i + 1}</div>
      <div class="text-[11px] text-muted line-clamp-2">${opt.title || '-'}</div>
      <textarea
        id="decision-note-${i}"
        rows="2"
        class="form-control text-xs w-full p-2 border-default rounded-lg bg-default"
        placeholder="${isRevision ? 'Apa yang perlu diperbaiki untuk judul ini?' : 'Alasan penolakan untuk judul ini...'}"
      ></textarea>
    </div>`
    )
    .join('');

  document.getElementById('decision-general-notes').value = '';
  const confirmBtn = document.getElementById('btn-confirm-decision');
  confirmBtn.style.backgroundColor = isRevision ? '' : '#DC2626';
  confirmBtn.innerText = isRevision ? 'Kirim Permintaan Revisi' : 'Kirim Penolakan';
  document.getElementById('decision-modal').classList.remove('hidden');
}

window.closeDecisionModal = () => {
  document.getElementById('decision-modal')?.classList.add('hidden');
  pendingDecisionType = null;
};

function collectDecisionNotes() {
  const fields = [...document.querySelectorAll('[id^="decision-note-"]')];
  const sorted = fields
    .map((el) => ({ idx: parseInt(el.id.split('-').pop(), 10), val: el.value.trim() }))
    .sort((a, b) => a.idx - b.idx);
  return {
    opt1: sorted[0]?.val || '',
    opt2: sorted[1]?.val || '',
    opt3: sorted[2]?.val || '',
    general: document.getElementById('decision-general-notes')?.value.trim() || '',
  };
}
