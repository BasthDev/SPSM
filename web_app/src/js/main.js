import '@hummingbirdui/hummingbird';
import { apiClient } from './apiClient.js';
import { authService, submissionService, formatDateShort, statusNorm } from './spsm.js';

let currentUserState = null;

// Sembunyikan semua menu sidebar yang punya batasan role sampai sesi dicek
const roleNavItems = document.querySelectorAll('[data-nav-roles]');
roleNavItems.forEach((el) => el.classList.add('hidden'));

// Global helper for opening dossier modal
window.openDossierModal = (sub) => {
  const modal = document.getElementById('dossier-modal');
  if (!modal || !sub) return;

  const docId = `SPSM-${(sub.$id || '').toUpperCase().slice(-20)}`;
  document.getElementById('modal-doc-id').innerText = `NO. DOKUMEN: ${docId}`;

  const normStatus = statusNorm(sub.status) || sub.status;

  // Status Badge
  const badge = document.getElementById('modal-status-badge');
  if (badge) {
    const statusMap = {
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
    const current = statusMap[normStatus] || statusMap[sub.status] || { label: String(sub.status || '').replace(/_/g, ' '), cls: 'bg-slate-100 text-slate-800' };
    badge.innerText = current.label;
    badge.className = `badge text-xs px-3 py-1 font-bold border ${current.cls}`;
  }

  // Overview Tab Data
  const submittedAtEl = document.getElementById('modal-submitted-at');
  if (submittedAtEl) submittedAtEl.innerText = formatDateShort(sub.submitted_at || sub.$createdAt);

  const deptEl = document.getElementById('modal-department');
  if (deptEl) deptEl.innerText = `${sub.student?.department || '-'} (Angkatan ${sub.student?.batch_year || 2026})`;

  const noSuratEl = document.getElementById('modal-nomor-surat');
  if (noSuratEl) noSuratEl.innerText = sub.nomor_surat ? `${sub.nomor_surat} (#${sub.urutan_surat || '01'})` : 'Belum Terbit';

  const sNameEl = document.getElementById('modal-student-name');
  if (sNameEl) sNameEl.innerText = sub.student?.name || 'Mahasiswa';

  const sNimEl = document.getElementById('modal-student-nim');
  if (sNimEl) sNimEl.innerText = sub.student?.nim_or_nip || sub.student_id;

  const sEmailEl = document.getElementById('modal-student-email');
  if (sEmailEl) sEmailEl.innerText = sub.student?.email || '-';

  const sPrefEl = document.getElementById('modal-student-pref-advisors');
  if (sPrefEl) {
    sPrefEl.innerText = sub.preferredAdvisor1
      ? `1. ${sub.preferredAdvisor1.name}${sub.preferredAdvisor2 ? `, 2. ${sub.preferredAdvisor2.name}` : ''}`
      : 'Tidak ada usulan';
  }

  // Advisors box
  const advBox = document.getElementById('modal-advisors-box');
  if (advBox) {
    if (sub.advisor) {
      advBox.innerHTML = `
        <div class="p-3 rounded-lg border border-default bg-subtle">
          <div class="text-[10px] font-bold text-primary uppercase">Pembimbing 1 (Utama)</div>
          <div class="font-bold text-default text-sm mt-0.5">${sub.advisor.name}</div>
          <div class="text-[11px] text-muted font-mono">NIP: ${sub.advisor.nip}</div>
        </div>
        ${
          sub.advisor2
            ? `
        <div class="p-3 rounded-lg border border-default bg-subtle">
          <div class="text-[10px] font-bold text-primary uppercase">Pembimbing 2 (Pendamping)</div>
          <div class="font-bold text-default text-sm mt-0.5">${sub.advisor2.name}</div>
          <div class="text-[11px] text-muted font-mono">NIP: ${sub.advisor2.nip}</div>
        </div>`
            : `
        <div class="p-3 rounded-lg border border-dashed border-default bg-subtle flex items-center justify-center text-xs text-muted italic">
          Pembimbing 2 belum ditetapkan
        </div>`
        }
      `;
    } else {
      advBox.innerHTML = `<div class="col-span-2 text-xs text-muted italic">Belum ada dosen pembimbing yang ditetapkan.</div>`;
    }
  }

  // Titles Tab
  const titlesCont = document.getElementById('modal-titles-container');
  if (titlesCont) {
    if (sub.options && sub.options.length > 0) {
      titlesCont.innerHTML = sub.options
        .map((opt) => {
          const isSelected = opt.is_selected_by_lecturer;
          const pdfUrl = opt.journal_file_id ? submissionService.getFileViewUrl(opt.journal_file_id) : null;
          return `
          <div class="p-4 rounded-xl border ${isSelected ? 'border-primary bg-primary-lighter/30 ring-1 ring-primary' : 'border-default bg-default'} space-y-2">
            <div class="flex items-center justify-between">
              <span class="badge ${isSelected ? 'badge-primary' : 'badge-neutral'} text-xs font-bold px-2 py-0.5">
                Opsi ${opt.option_number} ${isSelected ? '• Terpilih' : ''}
              </span>
              ${pdfUrl && pdfUrl !== '#' ? `<a href="${pdfUrl}" target="_blank" class="text-xs text-primary font-bold hover:underline flex items-center gap-1">Lihat Jurnal PDF ↗</a>` : ''}
            </div>
            <h4 class="text-sm font-bold text-default leading-snug">${opt.title}</h4>
            <p class="text-xs text-muted leading-relaxed">${opt.background || '-'}</p>
            ${
              opt.relevance_variable || opt.relevance_methodology || opt.relevance_note
                ? `
            <div class="p-3 rounded-lg bg-subtle border border-default text-[11px] space-y-1">
              <div class="font-bold text-primary">Tabel Relevansi Penelitian:</div>
              ${opt.relevance_variable ? `<div><span class="font-semibold text-muted">Variabel:</span> ${opt.relevance_variable}</div>` : ''}
              ${opt.relevance_methodology ? `<div><span class="font-semibold text-muted">Metodologi:</span> ${opt.relevance_methodology}</div>` : ''}
              ${opt.relevance_note ? `<div><span class="font-semibold text-muted">Kesesuaian:</span> ${opt.relevance_note}</div>` : ''}
            </div>`
                : ''
            }
            ${opt.journal_title || opt.journal_author || opt.journal_year ? `
            <div class="text-[11px] text-muted">
              <span class="font-semibold">Jurnal Acuan:</span>
              ${opt.journal_title || '-'}${opt.journal_author ? ` — ${opt.journal_author}` : ''}${opt.journal_year ? ` (${opt.journal_year})` : ''}
            </div>` : ''}
          </div>`;
        })
        .join('');
    } else {
      titlesCont.innerHTML = `<div class="text-xs text-muted italic">Data usulan opsi judul tidak tersedia.</div>`;
    }
  }

  // Files Tab
  const skBox = document.getElementById('modal-sk-box');
  if (skBox) {
    if ((sub.status === 'approved' || sub.status === 'sk_issued' || normStatus === 'sk_issued') && sub.nomor_surat) {
      skBox.classList.remove('hidden');
      document.getElementById('modal-sk-number').innerText = `NOMOR: ${sub.nomor_surat}`;
    } else {
      skBox.classList.add('hidden');
    }
  }

  const fileBox = document.getElementById('modal-draft-file-box');
  if (fileBox) {
    const uploadLog = (sub.logs || []).find((l) => l.action === 'UPLOAD_SKRSIPSI');
    if (uploadLog) {
      try {
        const fileInfo = JSON.parse(uploadLog.notes);
        const nameEl = document.getElementById('modal-draft-filename');
        const infoEl = document.getElementById('modal-draft-fileinfo');
        const linkEl = document.getElementById('modal-draft-filelink');

        if (nameEl) nameEl.innerText = fileInfo.file_name || 'Naskah_Skripsi_Final.pdf';
        if (infoEl) infoEl.innerText = `Naskah skripsi terunggah resmi oleh Mahasiswa • ${formatDateShort(uploadLog.created_at)}`;
        if (linkEl) {
          linkEl.href = fileInfo.file_id ? submissionService.getFileViewUrl(fileInfo.file_id) : '#';
          linkEl.innerText = 'Buka / Unduh Naskah';
        }
        fileBox.classList.remove('hidden');
      } catch {
        fileBox.classList.add('hidden');
      }
    } else {
      fileBox.classList.add('hidden');
    }
  }

  // Logs Tab
  const logsCont = document.getElementById('modal-logs-timeline');
  if (logsCont) {
    if (sub.logs && sub.logs.length > 0) {
      logsCont.innerHTML = sub.logs
        .map((l) => {
          const actionMap = {
            PENGAJUAN_MAHASISWA: { label: '📝 Pengajuan Mahasiswa', cls: 'bg-blue-100 text-blue-900 border-blue-200' },
            VERIFIKASI_DOSEN_PENILAI: { label: '🔍 Verifikasi Dosen Penilai', cls: 'bg-amber-100 text-amber-900 border-amber-200' },
            VERIFIKASI_DOSEN: { label: '🔍 Verifikasi Dosen Penilai', cls: 'bg-amber-100 text-amber-900 border-amber-200' },
            DISAHKAN_KAPRODI: { label: '⭐ Disahkan Kaprodi', cls: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
            MINTA_REVISI: { label: '⚠️ Permintaan Revisi', cls: 'bg-orange-100 text-orange-900 border-orange-200' },
            REVISI: { label: '⚠️ Permintaan Revisi', cls: 'bg-orange-100 text-orange-900 border-orange-200' },
            DITOLAK: { label: '❌ Pengajuan Ditolak', cls: 'bg-rose-100 text-rose-900 border-rose-200' },
            UPLOAD_SKRSIPSI: { label: '📁 Upload Naskah Skripsi', cls: 'bg-indigo-100 text-indigo-900 border-indigo-200' },
            REVISI_PENGAJUAN: { label: '✏️ Revisi Pengajuan', cls: 'bg-orange-100 text-orange-900 border-orange-200' },
          };

          const actionCfg = actionMap[l.action] || {
            label: (l.action || 'CATATAN').replace(/_/g, ' '),
            cls: 'bg-slate-100 text-slate-800 border-slate-200',
          };

          let formattedNotesHtml = '';
          const rawNote = (l.notes || '').trim();

          if (rawNote) {
            if (rawNote.startsWith('{')) {
              try {
                const parsed = JSON.parse(rawNote);

                // Format 1: Usulan Pembimbing Mahasiswa
                if (parsed.pref1_name || parsed.pref2_name || parsed.pref1 || parsed.pref2) {
                  const p1 = parsed.pref1_name || (parsed.pref1 ? `Dosen ID: ${parsed.pref1}` : 'Tidak ditentukan');
                  const p2 = parsed.pref2_name || (parsed.pref2 ? `Dosen ID: ${parsed.pref2}` : 'Tidak ditentukan');
                  formattedNotesHtml = `
                    <div class="mt-2 p-2.5 rounded-lg bg-default border border-default text-xs space-y-1.5">
                      <div class="text-[11px] font-bold text-slate-700">Usulan Calon Dosen Pembimbing oleh Mahasiswa:</div>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div class="p-2 rounded bg-subtle border border-default">
                          <span class="text-[10px] text-muted block font-semibold uppercase">Prioritas 1</span>
                          <span class="font-bold text-default">${p1}</span>
                        </div>
                        <div class="p-2 rounded bg-subtle border border-default">
                          <span class="text-[10px] text-muted block font-semibold uppercase">Prioritas 2</span>
                          <span class="font-bold text-default">${p2}</span>
                        </div>
                      </div>
                    </div>
                  `;
                }
                // Format 2: Pengesahan SK Kaprodi
                else if (parsed.nomor_surat) {
                  formattedNotesHtml = `
                    <div class="mt-2 p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-xs space-y-1.5">
                      <div class="text-emerald-950 font-medium">${parsed.text || 'Judul skripsi dan penetapan Dosen Pembimbing resmi disahkan oleh Kaprodi.'}</div>
                      <div class="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-md border border-emerald-200 shadow-2xs">
                        <span>📜 No. SK: ${parsed.nomor_surat}</span>
                        ${parsed.urutan ? `<span class="text-emerald-600 font-sans font-normal">(Urutan #${parsed.urutan})</span>` : ''}
                      </div>
                    </div>
                  `;
                }
                // Format 3: Upload Naskah Skripsi
                else if (parsed.file_name || l.action === 'UPLOAD_SKRSIPSI') {
                  formattedNotesHtml = `
                    <div class="mt-2 p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200 text-xs flex items-center justify-between gap-3">
                      <div>
                        <div class="font-bold text-indigo-950">${parsed.file_name || 'Berkas Naskah Skripsi.pdf'}</div>
                        <div class="text-[11px] text-indigo-700">${parsed.text || 'File naskah skripsi berhasil diunggah oleh mahasiswa.'}</div>
                      </div>
                      <span class="badge bg-indigo-600 text-white font-bold text-[10px] px-2 py-0.5 rounded shrink-0">Naskah Terupload</span>
                    </div>
                  `;
                }
                // Format 4: Catatan Revisi per Opsi
                else if (parsed.options_feedback || parsed.titles) {
                  const list = parsed.options_feedback || parsed.titles || [];
                  formattedNotesHtml = `
                    <div class="mt-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs space-y-1">
                      <div class="font-bold text-rose-900 mb-1">Catatan Evaluasi / Revisi:</div>
                      ${list.map((it, idx) => `<div class="text-rose-800"><span class="font-semibold">Opsi ${it.option_number || idx + 1}:</span> ${it.note || it.feedback || it}</div>`).join('')}
                    </div>
                  `;
                }
                // Fallback JSON parsed text
                else if (parsed.text || parsed.notes || parsed.message) {
                  formattedNotesHtml = `<div class="mt-1.5 text-xs text-default font-medium leading-relaxed">${parsed.text || parsed.notes || parsed.message}</div>`;
                } else {
                  formattedNotesHtml = `<div class="mt-1.5 text-xs text-default leading-relaxed">${rawNote}</div>`;
                }
              } catch {
                formattedNotesHtml = `<div class="mt-1.5 text-xs text-default leading-relaxed">${rawNote}</div>`;
              }
            } else {
              formattedNotesHtml = `<div class="mt-1.5 text-xs text-default font-medium leading-relaxed">${rawNote}</div>`;
            }
          }

          let dateFormatted = formatDateShort(l.created_at);
          try {
            const d = new Date(l.created_at);
            const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            dateFormatted = `${dateFormatted}, ${timeStr}`;
          } catch {}

          return `
          <div class="p-3.5 rounded-xl border border-default bg-subtle text-xs space-y-1 transition hover:border-slate-300">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="badge border font-bold text-[11px] px-2 py-0.5 rounded-md ${actionCfg.cls}">
                ${actionCfg.label}
              </span>
              <div class="flex items-center gap-2 text-[11px] text-muted font-mono">
                <span>${l.actor_name || l.actor_id || 'Sistem SPSM'}</span>
                <span>•</span>
                <span>${dateFormatted}</span>
              </div>
            </div>
            ${formattedNotesHtml}
          </div>`;
        })
        .join('');
    } else {
      logsCont.innerHTML = `<div class="text-xs text-muted italic text-center py-6">Belum ada jejak audit tersimpan untuk pengajuan ini.</div>`;
    }
  }

  modal.classList.remove('hidden');
};

window.closeDossierModal = () => {
  const modal = document.getElementById('dossier-modal');
  if (modal) modal.classList.add('hidden');
};

window.switchDossierTab = (tabName, btn) => {
  document.querySelectorAll('.dossier-tab-btn').forEach((b) => {
    b.classList.remove('active', 'text-primary', 'border-primary');
    b.classList.add('text-muted', 'border-transparent');
  });
  if (btn) {
    btn.classList.add('active', 'text-primary', 'border-primary');
    btn.classList.remove('text-muted', 'border-transparent');
  }

  document.querySelectorAll('.dossier-tab-content').forEach((c) => c.classList.add('hidden'));
  const target = document.getElementById(`tab-${tabName}`);
  if (target) target.classList.remove('hidden');
};

// Check session on load
document.addEventListener('DOMContentLoaded', async () => {
  const isSignInPage = window.location.pathname.endsWith('signin.html') || window.location.pathname.endsWith('signin');

  // === OAuth callback handler (Google sign-in via backend) ===
  // Backend melempar userId & secret ke URL setelah OAuth Google berhasil.
  // Tukar dengan token sesi SEBELUM cek auth apa pun.
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthUserId = urlParams.get('userId');
    const oauthSecret = urlParams.get('secret');
    if (oauthUserId && oauthSecret) {
      await apiClient.auth.exchangeOAuthSession(oauthUserId, oauthSecret);
      // Bersihkan URL agar tidak ada parameter sensitif & tidak ter-exchange ulang saat refresh
      window.history.replaceState({}, document.title, window.location.pathname);
      // Bila callback mendarat di halaman signin, arahkan ke dashboard utama
      if (isSignInPage) {
        window.location.replace('index.html');
        return;
      }
    }
  } catch (oauthErr) {
    console.warn('OAuth session exchange failed:', oauthErr);
  }

  try {
    const authState = await authService.getCurrentUser();
    currentUserState = authState;

    // Tampilkan menu sidebar sesuai role (admin bisa lihat semua)
    const activeRole = authState?.isAdmin ? 'admin' : authState?.role;
    roleNavItems.forEach((el) => {
      const allowed = (el.dataset.navRoles || '').split(',').filter(Boolean);
      const visible = authState?.isAdmin || allowed.includes(activeRole);
      el.classList.toggle('hidden', !visible);
    });

    if (!authState && !isSignInPage) {
      const path = window.location.pathname.replace(/\/[^/]*$/, '/');
      window.location.href = path + 'signin.html';
      return;
    }

    if (authState && isSignInPage) {
      // Show active session banner on signin page instead of silent auto-redirecting
      const banner = document.getElementById('active-session-banner');
      const infoEl = document.getElementById('active-session-info');
      const bannerLogout = document.getElementById('btn-banner-logout');

      const displayName =
        authState.lecturer?.name ||
        authState.profile?.name ||
        authState.account?.name ||
        (authState.isAdmin ? 'Admin Utama' : 'Dosen');

      const roleLabels = {
        admin: 'Administrator Kampus',
        reviewer: 'Dosen Penilai / Reviewer',
        kaprodi: 'Ketua Program Studi',
        lecturer: 'Dosen Pembimbing',
        student: 'Mahasiswa',
      };

      if (banner && infoEl) {
        infoEl.innerHTML = `Terdeteksi sesi aktif sebagai <strong>${displayName}</strong> (${roleLabels[authState.role] || authState.role}) [${authState.account?.email || ''}].`;
        banner.classList.remove('hidden');
      }

      if (bannerLogout) {
        bannerLogout.addEventListener('click', async () => {
          await authService.logout();
          window.location.reload();
        });
      }
    }

    if (authState) {
      const nameEl = document.getElementById('topbar-user-name');
      const roleEl = document.getElementById('topbar-user-role');
      const avatarEl = document.getElementById('topbar-user-avatar');
      const dropNameEl = document.getElementById('dropdown-user-name');
      const dropEmailEl = document.getElementById('dropdown-user-email');

      const displayName =
        authState.lecturer?.name ||
        authState.profile?.name ||
        authState.account?.name ||
        (authState.isAdmin ? 'Admin Utama' : 'Dosen');

      const roleLabels = {
        admin: 'Administrator',
        reviewer: 'Dosen Penilai',
        kaprodi: 'Ketua Prodi',
        lecturer: 'Dosen Pembimbing',
        student: 'Mahasiswa',
      };

      if (nameEl) nameEl.innerText = displayName;
      if (roleEl) roleEl.innerText = roleLabels[authState.role] || authState.role;
      if (dropNameEl) dropNameEl.innerText = displayName;
      if (dropEmailEl) dropEmailEl.innerText = authState.account?.email || '-';
      if (avatarEl && authState.avatarUrl) avatarEl.src = authState.avatarUrl;
    }
  } catch (err) {
    console.error('Session init failed', err);
  }

  // Logout button
  const logoutBtn = document.getElementById('btn-topbar-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Apakah Anda yakin ingin keluar dari SPSM Portal?')) {
        authService.logout();
      }
    });
  }
});

// ============ UX: Scroll Restoration + Prefetch ============
// Simpan posisi scroll per halaman di sessionStorage — saat user kembali
// ke halaman yang sama, scroll langsung dipulihkan (MPA reload total).
(function initScrollRestoration() {
  const key = 'spsm_scroll_' + location.pathname;

  // Pulihkan posisi scroll setelah halaman selesai render
  const saved = sessionStorage.getItem(key);
  if (saved) {
    const y = parseInt(saved, 10);
    if (!isNaN(y) && y > 0) {
      // Tunggu konten selesai dirender (fetch Appwrite bisa mengubah tinggi)
      const restore = () => window.scrollTo(0, y);
      if (document.readyState === 'complete') {
        setTimeout(restore, 150);
      } else {
        window.addEventListener('load', () => setTimeout(restore, 150));
      }
    }
  }

  // Simpan posisi scroll (debounced) saat user scroll
  let scrollTimer = null;
  window.addEventListener(
    'scroll',
    () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        sessionStorage.setItem(key, String(window.scrollY));
      }, 150);
    },
    { passive: true }
  );

  // Reset posisi scroll saat navigasi ke halaman baru via link dalam app
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (href && href.endsWith('.html')) {
      a.addEventListener('click', () => {
        sessionStorage.setItem('spsm_scroll_' + location.pathname, String(window.scrollY));
      });
    }
  });
})();

// Prefetch halaman lain saat user hover link sidebar — klik terasa instan
(function initPrefetch() {
  const prefetched = new Set();
  document.addEventListener('mouseover', (e) => {
    const a = e.target.closest('a[href$=".html"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href === location.pathname.split('/').pop() || prefetched.has(href)) return;
    prefetched.add(href);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
  });
})();
