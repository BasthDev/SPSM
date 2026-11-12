import { submissionService, authService } from './spsm.js';

let submissions = null;
let currentFilter = 'waiting_akademik';
let currentUserName = 'Staf Tata Usaha';

async function init() {
  try {
    const auth = await authService.getCurrentUser();
    if (auth) {
      currentUserName = auth.profile?.name || auth.account?.name || 'Staf Tata Usaha';
    }

    const subList = await submissionService.getAllSubmissions();
    submissions = subList;

    updateMetrics();
    renderTable();
  } catch (err) {
    console.error('Akademik init failed:', err);
  }
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast-feedback-akademik');
  if (!toast) return;
  toast.innerText = message;
  toast.className = `py-2 px-4 rounded-lg text-xs font-bold ${
    isError
      ? 'bg-red-50 text-red-800 border border-red-200'
      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
  }`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4000);
}

function updateMetrics() {
  const waiting = submissions.filter((s) => s.status === 'waiting_akademik').length;
  const process = submissions.filter((s) => s.status === 'sk_process').length;
  const issued = submissions.filter((s) => s.status === 'sk_issued' || s.status === 'approved').length;

  const wEl = document.getElementById('metric-waiting-akademik');
  const pEl = document.getElementById('metric-sk-process');
  const iEl = document.getElementById('metric-sk-issued');
  const tEl = document.getElementById('metric-total');

  if (wEl) wEl.innerText = waiting;
  if (pEl) pEl.innerText = process;
  if (iEl) iEl.innerText = issued;
  if (tEl) tEl.innerText = submissions.length;

  const cw = document.getElementById('count-waiting-akademik');
  const cp = document.getElementById('count-sk-process');
  const ci = document.getElementById('count-sk-issued');
  const ca = document.getElementById('count-all');

  if (cw) cw.innerText = waiting;
  if (cp) cp.innerText = process;
  if (ci) ci.innerText = issued;
  if (ca) ca.innerText = submissions.length;
}

function renderTable() {
  const tbody = document.getElementById('akademik-table-body');
if (submissions === null) {
    tbody.innerHTML = Array.from({ length: 5 }, () =>
      '<tr><td colspan="6" class="py-2 px-4"><div class="h-9 bg-slate-100 rounded-lg animate-pulse"></div></td></tr>'
    ).join('');
    return;
  }
    const searchInput = document.getElementById('akademik-search');
  const q = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const filtered = submissions.filter((s) => {
    if (currentFilter !== 'all') {
      if (currentFilter === 'sk_issued') {
        if (s.status !== 'sk_issued' && s.status !== 'approved') return false;
      } else if (s.status !== currentFilter) {
        return false;
      }
    }
    if (!q) return true;
    const name = s.student?.name?.toLowerCase() || '';
    const nim = s.student?.nim_or_nip?.toLowerCase() || '';
    const noSurat = s.nomor_surat?.toLowerCase() || '';
    const title =
      s.options?.find((o) => o.is_selected || o.is_selected_by_lecturer)?.title?.toLowerCase() ||
      s.options?.[0]?.title?.toLowerCase() ||
      '';
    return name.includes(q) || nim.includes(q) || noSurat.includes(q) || title.includes(q);
  });

  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-muted italic">Tidak ada pengajuan pada filter ini.</td></tr>`;
    return;
  }

  const statusBadges = {
    waiting_akademik: {
      label: 'Menunggu Draf & Cetak',
      cls: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    },
    sk_process: {
      label: 'Proses TTD Dekan',
      cls: 'bg-orange-100 text-orange-900 border-orange-300',
    },
    sk_issued: {
      label: 'SK Resmi Terbit',
      cls: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    },
    approved: {
      label: 'Disahkan (SK Terbit)',
      cls: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    },
    waiting_kaprodi: {
      label: 'Pleno Kaprodi',
      cls: 'bg-blue-100 text-blue-900 border-blue-300',
    },
    pending_lecturer: {
      label: 'Review Pembimbing',
      cls: 'bg-amber-100 text-amber-900 border-amber-300',
    },
  };

  tbody.innerHTML = filtered
    .map((sub) => {
      const student = sub.student;
      const chosenOpt =
        sub.options?.find((o) => o.is_selected || o.is_selected_by_lecturer) || sub.options?.[0];
      const statusBadge = statusBadges[sub.status] || {
        label: sub.status,
        cls: 'bg-slate-100 text-slate-800',
      };

      const nomorSuratDisplay = sub.nomor_surat || '(Menunggu Pengesahan)';
      const noDokumenDisplay = `SPSM-${(sub.$id || '').toUpperCase().slice(-8)}`;

      return `
      <tr class="hover:bg-subtle/80 transition-colors">
        <td class="py-3 px-4">
          <div class="font-bold text-default">${student?.name || 'Mahasiswa'}</div>
          <div class="font-mono text-muted text-[11px]">${student?.nim_or_nip || sub.student_id}</div>
          <div class="text-[10px] text-muted">${student?.department || 'TI'} (Angkatan ${student?.batch_year || 2026})</div>
        </td>
        <td class="py-3 px-4">
          <div class="font-mono font-bold text-xs text-primary">${nomorSuratDisplay}</div>
          <div class="font-mono text-[10px] text-muted">${noDokumenDisplay}</div>
        </td>
        <td class="py-3 px-4 max-w-xs">
          <div class="font-medium text-default line-clamp-2 text-xs">${chosenOpt?.title || '(Belum ada judul)'}</div>
        </td>
        <td class="py-3 px-4">
          <div class="text-xs font-semibold text-default">1. ${sub.advisor?.name || sub.advisor_1_id || '-'}</div>
          <div class="text-xs text-muted">2. ${sub.advisor2?.name || sub.advisor_2_id || '-'}</div>
        </td>
        <td class="py-3 px-4 whitespace-nowrap">
          <span class="badge text-xs px-2.5 py-0.5 font-bold border ${statusBadge.cls}">${statusBadge.label}</span>
        </td>
        <td class="py-3 px-4 text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onclick="window.openPrintableSk('${sub.$id}')"
              class="btn btn-outline-neutral text-xs font-bold py-1 px-2.5 rounded-lg hover:border-primary hover:text-primary"
              title="Cetak draf SK untuk TTD Dekan"
            >
              Cetak Draf
            </button>

            ${
              sub.status === 'waiting_akademik'
                ? `
              <button
                type="button"
                onclick="window.startDekanProcess('${sub.$id}')"
                class="btn btn-warning text-xs font-bold py-1 px-2.5 rounded-lg"
              >
                Proses TTD
              </button>
            `
                : ''
            }

            ${
              sub.status === 'sk_process'
                ? `
              <button
                type="button"
                onclick="window.openUploadSkModal('${sub.$id}')"
                class="btn btn-primary text-xs font-bold py-1 px-2.5 rounded-lg"
              >
                Unggah Scan SK
              </button>
            `
                : ''
            }

            ${
              sub.status === 'sk_issued' || sub.status === 'approved'
                ? `
              ${
                sub.surat?.scanned_sk_id
                  ? `
                <a
                  href="${submissionService.getFileViewUrl(sub.surat.scanned_sk_id)}"
                  target="_blank"
                  class="btn btn-outline-success text-xs font-bold py-1 px-2.5 rounded-lg"
                >
                  Lihat SK Basah
                </a>
              `
                  : ''
              }
            `
                : ''
            }

            <button
              type="button"
              onclick="window.openDossierModal(${JSON.stringify(sub).replace(/"/g, '&quot;')})"
              class="btn btn-neutral text-xs py-1 px-2 rounded-lg"
              title="Detail Berkas"
            >
              Detail
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');
}

// ---- Start Dekan Process Action ----
window.startDekanProcess = async (submissionId) => {
  if (
    !confirm(
      'Ubah status menjadi "Proses TTD Dekan"?\nPastikan draf SK fisik telah dicetak dan siap dimintakan tanda tangan basah Dekan.'
    )
  ) {
    return;
  }

  try {
    await submissionService.processDekanSignature(submissionId, currentUserName);
    showToast('Status berhasil diubah ke "Proses TTD Dekan".');
    await init();
  } catch (err) {
    showToast(`Gagal memproses: ${err.message}`, true);
  }
};

// ---- Upload Scan SK Modal ----
window.openUploadSkModal = (submissionId) => {
  const sub = submissions.find((s) => s.$id === submissionId);
  if (!sub) return;

  document.getElementById('upload-sub-id').value = sub.$id;
  document.getElementById('upload-doc-info').innerText = `NOMOR SURAT: ${sub.nomor_surat || '-'}`;
  document.getElementById('upload-student-info').innerText = `Mahasiswa: ${sub.student?.name || '-'} (${sub.student?.nim_or_nip || '-'})`;
  document.getElementById('upload-sk-file').value = '';
  document.getElementById('upload-sk-modal').classList.remove('hidden');
};

window.closeUploadSkModal = () => {
  document.getElementById('upload-sk-modal').classList.add('hidden');
};

// ---- Printable SK Generator ----
window.openPrintableSk = (submissionId) => {
  const sub = submissions.find((s) => s.$id === submissionId);
  if (!sub) return;

  const chosenOpt =
    sub.options?.find((o) => o.is_selected || o.is_selected_by_lecturer) || sub.options?.[0];
  const dateFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const printHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>DRAF SK - ${sub.nomor_surat || sub.$id}</title>
    <style>
      @page { size: A4 portrait; margin: 20mm; }
      body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; color: #000; margin: 0; padding: 20px; }
      .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 24px; }
      .header h3 { margin: 0; font-size: 14pt; text-transform: uppercase; font-weight: bold; }
      .header h2 { margin: 4px 0; font-size: 16pt; font-weight: bold; }
      .header p { margin: 0; font-size: 10pt; font-style: italic; }
      .title-section { text-align: center; margin-bottom: 20px; }
      .title-section h4 { margin: 0; text-transform: uppercase; text-decoration: underline; font-size: 13pt; }
      .title-section p { margin: 4px 0 0 0; font-size: 11pt; }
      .table-data { width: 100%; border-collapse: collapse; margin: 16px 0; }
      .table-data td { padding: 4px 6px; vertical-align: top; }
      .table-border { width: 100%; border-collapse: collapse; margin: 16px 0; }
      .table-border th, .table-border td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
      .table-border th { background: #f0f0f0; }
      .sign-section { margin-top: 40px; display: flex; justify-content: flex-end; }
      .sign-box { width: 250px; text-align: center; }
      .sign-space { height: 75px; }
      .barcode-box { margin-top: 20px; font-family: monospace; font-size: 9pt; color: #444; border: 1px dashed #666; padding: 8px; display: inline-block; }
      @media print {
        .no-print { display: none !important; }
        body { padding: 0; }
      }
    </style>
  </head>
  <body>
    <div class="no-print" style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 12px; margin-bottom: 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
      <div><strong>Pratinjau Draf SK Pengesahan Judul & Dosen Pembimbing</strong></div>
      <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">Cetak Dokumen Fisik</button>
    </div>

    <div class="header">
      <h3>UNIVERSITAS MUHAMMADIYAH ACEH</h3>
      <h2>FAKULTAS ILMU KOMPUTER</h2>
      <p>Jl. Muhammadiyah No. 91, Batoh, Lueng Bata, Banda Aceh • Telp: (0651) 123456 • Website: www.unmuha.ac.id</p>
    </div>

    <div class="title-section">
      <h4>SURAT KEPUTUSAN DEKAN FAKULTAS ILMU KOMPUTER</h4>
      <p>Nomor: ${sub.nomor_surat || '___/SPSM/TI/2026'}</p>
      <p><strong>TENTANG: PENGESAHAN JUDUL DAN PENETAPAN DOSEN PEMBIMBING SKRIPSI</strong></p>
    </div>

    <p>Dekan Fakultas Ilmu Komputer, setelah menimbang hasil verifikasi Komisi Pembimbing dan rekomendasi Ketua Program Studi, dengan ini menetapkan dan mengesahkan usulan penelitian skripsi kepada mahasiswa di bawah ini:</p>

    <table class="table-data">
      <tr>
        <td style="width: 25%;"><strong>Nama Mahasiswa</strong></td>
        <td style="width: 3%;">:</td>
        <td><strong>${sub.student?.name || 'Mahasiswa'}</strong></td>
      </tr>
      <tr>
        <td><strong>NIM</strong></td>
        <td>:</td>
        <td>${sub.student?.nim_or_nip || sub.student_id}</td>
      </tr>
      <tr>
        <td><strong>Program Studi</strong></td>
        <td>:</td>
        <td>${sub.student?.department || 'Teknik Informatika'} (Angkatan ${sub.student?.batch_year || 2026})</td>
      </tr>
      <tr>
        <td><strong>Judul Skripsi Disahkan</strong></td>
        <td>:</td>
        <td><em>"${chosenOpt?.title || '-'}"</em></td>
      </tr>
    </table>

    <p>Menetapkan Dosen Pembimbing Skripsi sebagai berikut:</p>

    <table class="table-border">
      <thead>
        <tr>
          <th style="width: 10%;">No.</th>
          <th>Nama Dosen Pembimbing</th>
          <th>NIP / NIDN</th>
          <th>Kedudukan</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td><strong>${sub.advisor?.name || sub.advisor_1_id || '-'}</strong></td>
          <td>${sub.advisor?.nip || '-'}</td>
          <td>Pembimbing 1 (Utama)</td>
        </tr>
        <tr>
          <td>2</td>
          <td><strong>${sub.advisor2?.name || sub.advisor_2_id || '-'}</strong></td>
          <td>${sub.advisor2?.nip || '-'}</td>
          <td>Pembimbing 2 (Pendamping)</td>
        </tr>
      </tbody>
    </table>

    <p>Surat Keputusan ini berlaku sejak tanggal ditetapkan, dengan ketentuan apabila di kemudian hari terdapat kekeliruan dalam keputusan ini, akan diadakan perbaikan sebagaimana mestinya.</p>

    <div class="sign-section">
      <div class="sign-box">
        <div>Ditetapkan di: Banda Aceh</div>
        <div>Pada tanggal: ${dateFormatted}</div>
        <div style="font-weight: bold; margin-top: 4px;">Dekan Fakultas Ilmu Komputer</div>
        <div class="sign-space"></div>
        <div style="font-weight: bold; text-decoration: underline;">Dr. Ir. Teuku Zulkarnain, M.Sc.</div>
        <div>NIP. 197003151996031002</div>
      </div>
    </div>

    <div class="barcode-box">
      NO. DOKUMEN SISTEM: SPSM-${(sub.$id || '').toUpperCase().slice(-8)} • VERIFIKASI DIGITAL KAMPUS
    </div>
  </body>
  </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(printHtml);
    printWindow.document.close();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  init();

  const searchInput = document.getElementById('akademik-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => { clearTimeout(searchInput._debounce); searchInput._debounce = setTimeout(renderTable, 200); });
  }

  const filterButtons = document.querySelectorAll('#akademik-filter-group button');
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => {
        b.className =
          'btn btn-outline-neutral text-xs font-semibold py-1.5 px-3 rounded-lg cursor-pointer';
      });
      btn.className = 'btn btn-primary text-xs font-bold py-1.5 px-3 rounded-lg cursor-pointer';
      currentFilter = btn.dataset.filter;
      renderTable();
    });
  });

  const uploadForm = document.getElementById('upload-sk-form');
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const subId = document.getElementById('upload-sub-id').value;
      const fileInput = document.getElementById('upload-sk-file');
      if (!fileInput.files || fileInput.files.length === 0) {
        alert('Pilih file scan SK terlebih dahulu.');
        return;
      }

      const file = fileInput.files[0];
      const submitBtn = document.getElementById('btn-submit-upload-sk');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Mengunggah & Menerbitkan...';
      }

      try {
        await submissionService.uploadSignedSk(subId, file, currentUserName);
        closeUploadSkModal();
        showToast('SK resmi ber-TTD basah Dekan berhasil diterbitkan!');
        await init();
      } catch (err) {
        showToast(`Gagal mengunggah SK: ${err.message}`, true);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Unggah & Terbitkan SK';
        }
      }
    });
  }
});
