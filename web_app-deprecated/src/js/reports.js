import { lecturerService, submissionService, masterDataService, formatDateShort, statusNorm } from './spsm.js';

let lecturers = null;
let submissions = null;
let activeSubmissionsList = [];
let reportDepartments = [];

// Cocokkan nilai filter prodi terhadap id/code/nama department
function deptMatches(selectedDept, ...candidates) {
  if (selectedDept === 'all') return true;
  const dept = reportDepartments.find((d) => (d.$id || d.id) === selectedDept || d.code === selectedDept);
  const keys = [selectedDept, dept?.code, dept?.name, dept?.$id, dept?.id].filter(Boolean).map((k) => String(k).toUpperCase());
  return candidates.some((c) => {
    const v = String(c || '').toUpperCase();
    return v && keys.some((k) => v === k || v.includes(k));
  });
}

function populateDeptFilters(depts) {
  reportDepartments = depts || [];
  ['report-dept-filter', 'report-student-dept-filter'].forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel || reportDepartments.length === 0) return;
    const cur = sel.value;
    sel.innerHTML =
      `<option value="all">Semua Program Studi</option>` +
      reportDepartments
        .map((d) => {
          const val = d.$id || d.id;
          const label = d.code ? `${d.name || d.code} (${d.code})` : d.name || d.code || val;
          return `<option value="${val}">${label}</option>`;
        })
        .join('');
    if (cur && cur !== 'all') sel.value = cur;
  });
}

async function init() {
  try {
    const [lecList, subList, deptList] = await Promise.all([
      lecturerService.getLecturers(),
      submissionService.getSubmissions(),
      masterDataService.getDepartments().catch(() => []),
    ]);

    lecturers = lecList;
    submissions = subList;
    populateDeptFilters(deptList);

    renderLecturersReport();
    renderFinishedStudentsReport();
  } catch (err) {
    console.error('Reports init failed:', err);
  }
}

// Switch between Tab 1 (Kinerja Dosen) and Tab 2 (Mahasiswa Selesai Skripsi)
window.switchReportTab = (tabName, btn) => {
  document.querySelectorAll('.report-tab-btn').forEach((b) => {
    b.classList.remove('active', 'text-primary', 'border-primary');
    b.classList.add('text-muted', 'border-transparent');
  });
  if (btn) {
    btn.classList.add('active', 'text-primary', 'border-primary');
    btn.classList.remove('text-muted', 'border-transparent');
  }

  document.querySelectorAll('.report-tab-section').forEach((s) => s.classList.add('hidden'));
  const target = document.getElementById(`reporttab-${tabName}`);
  if (target) target.classList.remove('hidden');
};

function renderLecturersReport() {
  const tbody = document.getElementById('report-table-body');
  if (lecturers === null) {
    tbody.innerHTML = Array.from({ length: 6 }, () => '<tr><td colspan="8" class="py-2 px-4"><div class="h-9 bg-slate-100 rounded-lg animate-pulse"></div></td></tr>').join('');
    return;
  }
  const deptSelect = document.getElementById('report-dept-filter');
  const counterEl = document.getElementById('report-counter');

  const selectedDept = deptSelect ? deptSelect.value : 'all';

  const filtered = lecturers.filter((l) => {
    if (!deptMatches(selectedDept, l.department_id, l.departmentId, l.department, l.department_code)) return false;
    return true;
  });

  // Calculate per-lecturer stats from submissions and logs
  let globalAccepted = 0;
  let globalRejected = 0;

  const lecturerStats = filtered.map((lec) => {
    const lecId = lec.$id;
    const lecNip = lec.nip;
    const lecName = (lec.name || '').toLowerCase();

    // 1. Acceptance & Rejection Count
    let accepted = 0;
    let rejected = 0;

    submissions.forEach((sub) => {
      const logs = sub.logs || [];
      logs.forEach((lg) => {
        const actor = (lg.actor_id || '').toLowerCase();
        const isMatch = actor.includes(lecName) || actor.includes(lecNip) || actor.includes(lecId);

        if (isMatch) {
          if (lg.action.includes('DISAHKAN') || lg.action.includes('VERIFIKASI') || lg.action.includes('SETUJUI')) {
            accepted++;
          } else if (lg.action.includes('TOLAK') || lg.action.includes('REVISI')) {
            rejected++;
          }
        }
      });

      // Count if assigned as advisor in approved/waiting submission
      if (sub.advisor?.$id === lecId || sub.advisor2?.$id === lecId) {
        if (statusNorm(sub.status) === 'sk_issued' || sub.status === 'waiting_kaprodi') {
          // If not already counted in logs
          if (accepted === 0 && statusNorm(sub.status) === 'sk_issued') accepted++;
        }
      }
    });

    globalAccepted += accepted;
    globalRejected += rejected;

    const totalDecisions = accepted + rejected;
    const approvalRate = totalDecisions > 0 ? Math.round((accepted / totalDecisions) * 100) : 100;

    const quota = lec.quota || 10;
    const current = lec.current_students || 0;
    const pct = Math.min(100, Math.round((current / quota) * 100));

    return {
      ...lec,
      accepted,
      rejected,
      totalDecisions,
      approvalRate,
      current,
      quota,
      pct,
    };
  });

  // Update Summary Metrics
  const totalLecs = filtered.length;
  const totalDecisionsAll = globalAccepted + globalRejected;
  const avgApproval = totalDecisionsAll > 0 ? Math.round((globalAccepted / totalDecisionsAll) * 100) : 100;

  const totalLecEl = document.getElementById('rep-total-lecturers');
  if (totalLecEl) totalLecEl.innerText = totalLecs;

  const totalAccEl = document.getElementById('rep-total-accepted');
  if (totalAccEl) totalAccEl.innerText = globalAccepted;

  const totalRejEl = document.getElementById('rep-total-rejected');
  if (totalRejEl) totalRejEl.innerText = globalRejected;

  const avgAppEl = document.getElementById('rep-avg-approval');
  if (avgAppEl) avgAppEl.innerText = `${avgApproval}%`;

  if (counterEl) counterEl.innerText = `Menampilkan ${filtered.length} dosen`;

  if (!tbody) return;

  if (lecturerStats.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-muted italic">Tidak ada data dosen pada program studi ini.</td></tr>`;
    return;
  }

  const roleLabels = {
    lecturer: 'Dosen Pembimbing',
    reviewer: 'Dosen Penilai',
    kaprodi: 'Ketua Prodi',
    admin: 'Administrator',
  };

  tbody.innerHTML = lecturerStats
    .map((lec) => {
      let statusBadge = `<span class="badge bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs px-2 py-0.5 font-bold">Tersedia</span>`;
      if (lec.pct >= 100) {
        statusBadge = `<span class="badge bg-rose-50 text-rose-800 border border-rose-300 text-xs px-2 py-0.5 font-bold">Penuh</span>`;
      } else if (lec.pct >= 80) {
        statusBadge = `<span class="badge bg-amber-50 text-amber-800 border border-amber-300 text-xs px-2 py-0.5 font-bold">Hampir Penuh</span>`;
      }

      return `
      <tr class="hover:bg-subtle/80 transition-colors">
        <td class="py-3 px-4">
          <div class="font-bold text-default">${lec.name}</div>
          <div class="font-mono text-muted text-[11px]">NIP: ${lec.nip}</div>
        </td>
        <td class="py-3 px-4">
          <span class="badge badge-neutral text-xs px-2 py-0.5">${(() => {
            const raw = lec.department_id || '';
            const hit = reportDepartments.find((d) => d.code === raw || (d.$id || d.id) === raw || d.name === raw);
            return hit ? hit.name : (raw || 'TI');
          })()}</span>
        </td>
        <td class="py-3 px-4 font-semibold text-muted text-xs">
          ${roleLabels[lec.role] || lec.role}
        </td>
        <td class="py-3 px-4 text-center">
          <span class="inline-flex items-center justify-center font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-0.5 text-xs">
            ${lec.accepted}
          </span>
        </td>
        <td class="py-3 px-4 text-center">
          <span class="inline-flex items-center justify-center font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2.5 py-0.5 text-xs">
            ${lec.rejected}
          </span>
        </td>
        <td class="py-3 px-4 min-w-[130px]">
          <div class="flex items-center justify-between text-[11px] mb-1">
            <span class="font-bold text-default">${lec.approvalRate}%</span>
            <span class="text-muted text-[10px]">(${lec.accepted}/${lec.totalDecisions || 1})</span>
          </div>
          <div class="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div class="h-full ${lec.approvalRate >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}" style="width: ${lec.approvalRate}%"></div>
          </div>
        </td>
        <td class="py-3 px-4 min-w-[140px]">
          <div class="flex items-center justify-between text-[11px] mb-1">
            <span class="font-bold text-default">${lec.current} / ${lec.quota} mhs</span>
            <span class="text-muted font-mono">${lec.pct}%</span>
          </div>
          <div class="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div class="h-full ${lec.pct >= 100 ? 'bg-rose-500' : lec.pct >= 80 ? 'bg-amber-500' : 'bg-primary'}" style="width: ${lec.pct}%"></div>
          </div>
        </td>
        <td class="py-3 px-4">
          ${statusBadge}
        </td>
      </tr>`;
    })
    .join('');
}

function renderFinishedStudentsReport() {
  const tbody = document.getElementById('student-report-table-body');
  const deptSelect = document.getElementById('report-student-dept-filter');
  const searchInput = document.getElementById('search-finished-students');
  const counterEl = document.getElementById('student-report-counter');

  const selectedDept = deptSelect ? deptSelect.value : 'all';
  const q = searchInput ? searchInput.value.trim().toLowerCase() : '';

  // Filter only approved / finished thesis submissions
  if (submissions === null) return;
  const finishedSubs = submissions.filter((sub) => {
    const isApproved = statusNorm(sub.status) === 'sk_issued' || Boolean(sub.nomor_surat);
    if (!isApproved) return false;

    const dept = sub.student?.department || '-';
    if (!deptMatches(selectedDept, dept)) return false;

    if (q) {
      const sName = (sub.student?.name || '').toLowerCase();
      const sNim = (sub.student?.nim_or_nip || sub.student_id || '').toLowerCase();
      const sNoSurat = (sub.nomor_surat || '').toLowerCase();
      const selOpt = (sub.options || []).find((o) => o.is_selected_by_lecturer) || sub.options?.[0];
      const title = (selOpt?.title || '').toLowerCase();

      return sName.includes(q) || sNim.includes(q) || sNoSurat.includes(q) || title.includes(q);
    }

    return true;
  });

  activeSubmissionsList = finishedSubs;

  // Calculate Metrics for finished students
  let totalUploaded = 0;
  let latestSk = '-';

  finishedSubs.forEach((sub) => {
    const uploadLog = (sub.logs || []).find((l) => l.action === 'UPLOAD_SKRSIPSI');
    if (uploadLog || sub.student?.has_uploaded_thesis) {
      totalUploaded++;
    }
    if (sub.nomor_surat && latestSk === '-') {
      latestSk = sub.nomor_surat;
    }
  });

  const totalGraduated = finishedSubs.length;
  const pendingUpload = Math.max(0, totalGraduated - totalUploaded);

  const gradEl = document.getElementById('rep-total-graduated');
  if (gradEl) gradEl.innerText = totalGraduated;

  const upEl = document.getElementById('rep-total-uploaded');
  if (upEl) upEl.innerText = totalUploaded;

  const pendEl = document.getElementById('rep-total-pending-upload');
  if (pendEl) pendEl.innerText = pendingUpload;

  const lastSkEl = document.getElementById('rep-latest-sk');
  if (lastSkEl) lastSkEl.innerText = latestSk;

  if (counterEl) {
    counterEl.innerText = `Menampilkan ${finishedSubs.length} mahasiswa selesai skripsi`;
  }

  if (!tbody) return;

  if (finishedSubs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-muted italic">Belum ada pengajuan mahasiswa yang berstatus Disahkan (SK Terbit) untuk kriteria ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = finishedSubs
    .map((sub, idx) => {
      const selectedOption = (sub.options || []).find((o) => o.is_selected_by_lecturer) || sub.options?.[0];
      const titleText = selectedOption ? selectedOption.title : 'Judul Skripsi Disahkan';

      // Check upload skripsi file log
      const uploadLog = (sub.logs || []).find((l) => l.action === 'UPLOAD_SKRSIPSI');
      let uploadedFileInfo = null;
      if (uploadLog) {
        try {
          uploadedFileInfo = JSON.parse(uploadLog.notes);
        } catch {}
      }

      const hasUploaded = Boolean(uploadedFileInfo || sub.student?.has_uploaded_thesis);
      const fileUrl = uploadedFileInfo?.file_id
        ? submissionService.getFileViewUrl(uploadedFileInfo.file_id)
        : selectedOption?.journal_file_id
        ? submissionService.getFileViewUrl(selectedOption.journal_file_id)
        : null;

      const fileBadge = hasUploaded
        ? `
        <div class="inline-flex flex-col items-center gap-1">
          <span class="badge bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-[11px] px-2 py-0.5 rounded">
            ✓ Naskah Terupload
          </span>
          ${fileUrl ? `<a href="${fileUrl}" target="_blank" class="text-[10px] text-primary font-bold hover:underline flex items-center gap-0.5">Buka Naskah ↗</a>` : ''}
        </div>`
        : `
        <span class="badge bg-amber-50 text-amber-800 border border-amber-300 font-medium text-[11px] px-2 py-0.5 rounded">
          Menunggu Naskah
        </span>`;

      const adv1 = sub.advisor?.name || 'Pembimbing 1';
      const adv2 = sub.advisor2?.name;

      return `
      <tr class="hover:bg-subtle/80 transition-colors">
        <td class="py-3 px-4">
          <div class="font-bold text-default">${sub.student?.name || 'Mahasiswa'}</div>
          <div class="font-mono text-muted text-[11px]">NIM: ${sub.student?.nim_or_nip || sub.student_id}</div>
        </td>
        <td class="py-3 px-4">
          <div class="font-semibold text-default">${sub.student?.department || '-'}</div>
          <div class="text-muted text-[11px]">Angkatan ${sub.student?.batch_year || 2026}</div>
        </td>
        <td class="py-3 px-4 max-w-xs">
          <div class="font-medium text-default line-clamp-2 leading-snug">${titleText}</div>
        </td>
        <td class="py-3 px-4 text-xs">
          <div class="font-bold text-default">1. ${adv1}</div>
          ${adv2 ? `<div class="text-muted text-[11px] mt-0.5">2. ${adv2}</div>` : ''}
        </td>
        <td class="py-3 px-4">
          <span class="font-mono font-bold text-xs text-primary bg-primary-lighter/60 px-2 py-0.5 rounded border border-primary/20 whitespace-nowrap">
            ${sub.nomor_surat || '01/SPSM/TI/23/2026'}
          </span>
        </td>
        <td class="py-3 px-4 text-center">
          ${fileBadge}
        </td>
        <td class="py-3 px-4 text-muted font-mono text-[11px] whitespace-nowrap">
          ${formatDateShort(sub.sk_generated_at || sub.$updatedAt || sub.submitted_at)}
        </td>
        <td class="py-3 px-4 text-center">
          <button
            type="button"
            class="btn btn-outline-neutral text-xs py-1 px-2.5 rounded-lg font-bold hover:border-primary hover:text-primary transition"
            onclick="viewReportDossier(${idx})"
          >
            Dossier
          </button>
        </td>
      </tr>`;
    })
    .join('');
}

window.viewReportDossier = (idx) => {
  const sub = activeSubmissionsList ? activeSubmissionsList[idx] : null;
  if (sub && window.openDossierModal) {
    window.openDossierModal(sub);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  init();

  const deptFilter1 = document.getElementById('report-dept-filter');
  if (deptFilter1) {
    deptFilter1.addEventListener('change', () => renderLecturersReport());
  }

  const deptFilter2 = document.getElementById('report-student-dept-filter');
  if (deptFilter2) {
    deptFilter2.addEventListener('change', () => renderFinishedStudentsReport());
  }

  const searchFinished = document.getElementById('search-finished-students');
  if (searchFinished) {
    searchFinished.addEventListener('input', () => { clearTimeout(searchFinished._debounce); searchFinished._debounce = setTimeout(renderFinishedStudentsReport, 200); });
  }
});
