import { submissionService, lecturerService, authService, statusNorm } from './spsm.js';

let submissions = null;
let lecturers = [];
let currentFilter = 'waiting_kaprodi';
let selectedSubmission = null;
let currentKaprodiName = 'Ketua Program Studi';
let lastFiltered = []; // referensi array terfilter terakhir untuk indexing btn onclick

async function init() {
  try {
    const auth = await authService.getCurrentUser();
    if (auth) {
      currentKaprodiName = auth.lecturer?.name || auth.profile?.name || auth.account?.name || 'Ketua Program Studi';
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
    console.error('Kaprodi init failed:', err);
  }
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast-feedback-kaprodi');
  if (!toast) return;
  toast.innerText = message;
  toast.className = `py-2 px-4 rounded-lg text-xs font-bold ${
    isError ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
  }`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4000);
}

function updateMetrics() {
  const waiting = submissions.filter((s) => statusNorm(s.status) === 'waiting_kaprodi').length;
  const approved = submissions.filter((s) => ['sk_issued', 'waiting_akademik', 'sk_process'].includes(statusNorm(s.status))).length;

  document.getElementById('kaprodi-waiting-count').innerText = waiting;
  document.getElementById('kaprodi-total-count').innerText = submissions.length;
  document.getElementById('kaprodi-approved-count').innerText = approved;

  document.getElementById('count-wait-k').innerText = waiting;
  document.getElementById('count-app-k').innerText = approved;
  document.getElementById('count-all-k').innerText = submissions.length;
}

function renderTable() {
  const tbody = document.getElementById('kaprodi-table-body');
if (submissions === null) {
    tbody.innerHTML = Array.from({ length: 5 }, () =>
      '<tr><td colspan="6" class="py-2 px-4"><div class="h-9 bg-slate-100 rounded-lg animate-pulse"></div></td></tr>'
    ).join('');
    return;
  }
    const searchInput = document.getElementById('kaprodi-search');
  const q = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const filtered = submissions.filter((s) => {
    if (currentFilter !== 'all') {
      if (currentFilter === 'approved') {
        const isApproved = ['sk_issued', 'waiting_akademik', 'sk_process'].includes(statusNorm(s.status));
        if (!isApproved) return false;
      } else if (statusNorm(s.status) !== currentFilter) {
        return false;
      }
    }
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
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-muted italic">Tidak ada pengajuan pada filter ini.</td></tr>`;
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
          <div class="font-bold text-default text-xs line-clamp-2 leading-snug">${chosenOpt?.title || '(Belum ada judul)'}</div>
          <div class="text-[11px] text-primary font-semibold mt-0.5">Opsi ${chosenOpt?.option_number || 1} Terpilih</div>
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
              : `<span class="text-muted italic text-[11px]">Belum ditetapkan</span>`
          }
        </td>
        <td class="py-3 px-4 text-center whitespace-nowrap space-x-1.5">
          <button
            type="button"
            class="btn btn-outline-neutral text-xs py-1.5 px-2.5 rounded-lg"
            onclick="viewDossierKaprodi(${idx})"
          >
            Berkas
          </button>
          ${
            statusNorm(sub.status) === 'waiting_kaprodi'
              ? `
            <button
              type="button"
              class="btn btn-primary bg-emerald-700 hover:bg-emerald-800 border-none text-white text-xs font-bold py-1.5 px-3 rounded-lg"
              onclick="openKaprodiModal(${idx})"
            >
              Sahkan SK
            </button>`
              : `
            <span class="text-[11px] font-bold text-emerald-700">SK Terbit ✓</span>`
          }
        </td>
      </tr>`;
    })
    .join('');
}

window.viewDossierKaprodi = (idx) => {
  const sub = lastFiltered[idx];
  if (sub && window.openDossierModal) {
    window.openDossierModal(sub);
  }
};

window.openKaprodiModal = (idx) => {
  const sub = lastFiltered[idx];
  if (!sub) return;
  selectedSubmission = sub;

  const chosenOpt = sub.options?.find((o) => o.is_selected_by_lecturer) || sub.options?.[0];

  document.getElementById('kaprodi-modal-subhead').innerText = `${sub.student?.name || 'Mahasiswa'} • NIM: ${
    sub.student?.nim_or_nip || sub.student_id
  } • ${sub.student?.department || 'TI'}`;

  document.getElementById('kaprodi-modal-title').innerText = chosenOpt?.title || '(Judul Terpilih)';
  document.getElementById('kaprodi-modal-bg').innerText = chosenOpt?.background || '-';

  const adv1Select = document.getElementById('kaprodi-adv-1');
  const adv2Select = document.getElementById('kaprodi-adv-2');

  if (adv1Select) {
    adv1Select.value = sub.advisor?.$id || sub.preferredAdvisor1?.$id || (lecturers[0]?.$id || '');
  }
  if (adv2Select) {
    adv2Select.value = sub.advisor2?.$id || sub.preferredAdvisor2?.$id || '';
  }

  document.getElementById('kaprodi-notes').value = '';
  document.getElementById('kaprodi-modal').classList.remove('hidden');
};

window.closeKaprodiModal = () => {
  const modal = document.getElementById('kaprodi-modal');
  if (modal) modal.classList.add('hidden');
};

function setupAdvisorDropdowns() {
  const adv1 = document.getElementById('kaprodi-adv-1');
  const adv2 = document.getElementById('kaprodi-adv-2');

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
  const searchInput = document.getElementById('kaprodi-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => { clearTimeout(searchInput._debounce); searchInput._debounce = setTimeout(renderTable, 200); });
  }

  // Filter Buttons
  document.querySelectorAll('#kaprodi-filter-group button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#kaprodi-filter-group button').forEach((b) => {
        b.className = 'btn btn-outline-neutral text-xs font-semibold py-1.5 px-3 rounded-lg cursor-pointer';
      });
      btn.className = 'btn btn-primary text-xs font-bold py-1.5 px-3 rounded-lg cursor-pointer';
      currentFilter = btn.getAttribute('data-filter') || 'all';
      renderTable();
    });
  });

  // Approve SK
  const approveBtn = document.getElementById('btn-kaprodi-approve');
  if (approveBtn) {
    approveBtn.addEventListener('click', async () => {
      if (!selectedSubmission) return;

      const adv1 = document.getElementById('kaprodi-adv-1').value;
      const adv2 = document.getElementById('kaprodi-adv-2').value;
      const notes = document.getElementById('kaprodi-notes').value.trim();

      if (!adv1) {
        alert('Dosen Pembimbing 1 (Utama) wajib ditetapkan!');
        return;
      }
      if (adv1 && adv2 && adv1 === adv2) {
        alert('Pembimbing 1 dan Pembimbing 2 tidak boleh orang yang sama!');
        return;
      }

      approveBtn.disabled = true;
      approveBtn.innerText = 'Mengesahkan SK...';

      try {
        await submissionService.kaprodiApprove(
          selectedSubmission.$id,
          adv1,
          adv2,
          currentKaprodiName,
          notes
        );
        showToast('SK Resmi dan Nomor Surat berhasil diterbitkan! Status telah Disetujui.');
        closeKaprodiModal();
        init();
      } catch (err) {
        showToast(`Gagal mengesahkan: ${err.message}`, true);
      } finally {
        approveBtn.disabled = false;
        approveBtn.innerText = 'Sahkan & Terbitkan SK';
      }
    });
  }

  // Minta Revisi / Tolak via modal catatan per-judul
  const btnRevision = document.getElementById('btn-kaprodi-revision');
  if (btnRevision) {
    btnRevision.addEventListener('click', () => openDecisionModal('revisi'));
  }
  const btnReject = document.getElementById('btn-kaprodi-reject');
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
          await submissionService.requestRevision(selectedSubmission.$id, currentKaprodiName, notes);
          showToast('Status berhasil diubah menjadi Perlu Revisi.');
        } else {
          await submissionService.rejectSubmission(selectedSubmission.$id, currentKaprodiName, notes, advisorId);
          showToast('Pengajuan resmi ditolak.');
        }
        closeDecisionModal();
        closeKaprodiModal();
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
