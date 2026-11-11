import { repoService } from './spsm.js';

let allFiles = [];

const stripOwnerPrefix = (name) => (name || '').replace(/^owner_[^_]+__/, '');

const formatSize = (bytes) => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const formatDate = (iso) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

function renderTable() {
  const tbody = document.getElementById('repo-table-body');
  const counter = document.getElementById('repo-count');
  const searchInput = document.getElementById('repo-search');
  const q = (searchInput?.value || '').trim().toLowerCase();
  if (!tbody) return;

  const filtered = allFiles.filter((f) => stripOwnerPrefix(f.name).toLowerCase().includes(q));
  if (counter) counter.innerText = `${filtered.length} file ditampilkan`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-muted italic">${
      q ? 'File tidak ditemukan.' : 'Belum ada file di repository.'
    }</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((f) => {
      const viewUrl = repoService.getFileViewUrl(f.$id);
      const dlUrl = repoService.getFileDownloadUrl(f.$id);
      return `
      <tr class="hover:bg-subtle/80 transition-colors">
        <td class="py-3 px-4">
          <div class="font-semibold text-default text-xs">${stripOwnerPrefix(f.name)}</div>
        </td>
        <td class="py-3 px-4 text-muted font-mono text-[11px]">${formatSize(f.sizeOriginal)}</td>
        <td class="py-3 px-4 text-muted text-[11px]">${formatDate(f.$createdAt)}</td>
        <td class="py-3 px-4 text-center whitespace-nowrap space-x-1.5">
          ${viewUrl !== '#' ? `<a href="${viewUrl}" target="_blank" rel="noreferrer" class="btn btn-outline-neutral text-xs py-1 px-2.5 rounded-lg">Lihat</a>` : ''}
          ${dlUrl !== '#' ? `<a href="${dlUrl}" class="btn btn-outline-neutral text-xs py-1 px-2.5 rounded-lg" download="${stripOwnerPrefix(f.name)}">Unduh</a>` : ''}
        </td>
      </tr>`;
    })
    .join('');
}

async function init() {
  const tbody = document.getElementById('repo-table-body');
  try {
    allFiles = await repoService.listAllFiles();
  } catch (err) {
    console.error('Repo load failed:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-rose-600">Gagal memuat file: ${err.message || err}</td></tr>`;
    return;
  }
  renderTable();
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  document.getElementById('repo-search')?.addEventListener('input', renderTable);
});
