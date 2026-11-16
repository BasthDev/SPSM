import React, { useState, useEffect } from 'react';
import { storageService, type RepoFile } from '../services/storageService';
import { FileText, Download, ExternalLink, Search, X, FolderOpen, AlertCircle } from 'lucide-react';

const formatSize = (bytes: number): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const formatDate = (iso?: string) => {
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

/** Strip owner_<userId>__ prefix for display */
const displayName = (name: string): string => name.replace(/^owner_[^_]+__/, '');

export const RepoBrowser: React.FC = () => {
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await storageService.listAllFiles();
      setFiles(res);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat file repository.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = files.filter((f) =>
    displayName(f.name).toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="tab-content">
      <div className="section-header">
        <div>
          <h2 className="page-title">Repository File Skripsi</h2>
          <p className="page-desc">
            Semua file yang diupload mahasiswa melalui aplikasi. Total {files.length} file.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <div className="search-box" style={{ flex: 1, maxWidth: 420 }}>
          <Search size={16} className="search-box-icon" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama file..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-box-input"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="search-box-clear"
              title="Hapus pencarian"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <span className="text-xs text-slate-500">
          {filtered.length} file ditampilkan
        </span>
      </div>

      {/* File List */}
      <div className="card table-card">
        {loading ? (
          <div className="text-center p-4">
            <div className="spinner" />
            <p className="text-xs text-slate-500 mt-2">Memuat file...</p>
          </div>
        ) : error ? (
          <div className="text-center p-4">
            <AlertCircle size={36} className="text-rose-500 mx-auto" />
            <p className="text-sm text-rose-700 mt-2">{error}</p>
            <button onClick={loadFiles} className="btn btn-secondary btn-sm mt-2">
              Coba Lagi
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center p-4">
            <FolderOpen size={36} className="text-slate-300 mx-auto" />
            <p className="text-sm text-slate-500 mt-2">
              {search ? 'File tidak ditemukan.' : 'Belum ada file di repository.'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Nama File</th>
                  <th>Ukuran</th>
                  <th>Tanggal Upload</th>
                  <th className="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => {
                  const viewUrl = storageService.getFileViewUrl(f.$id);
                  const dlUrl = storageService.getFileDownloadUrl(f.$id);
                  return (
                    <tr key={f.$id}>
                      <td>
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={16} className="text-primary shrink-0" />
                          <span className="font-medium text-slate-800 truncate">
                            {displayName(f.name)}
                          </span>
                        </div>
                      </td>
                      <td className="text-xs text-slate-600 font-mono">
                        {formatSize(f.sizeOriginal)}
                      </td>
                      <td className="text-xs text-slate-600">
                        {formatDate(f.$createdAt)}
                      </td>
                      <td>
                        <div className="action-button-group" style={{ justifyContent: 'center' }}>
                          {viewUrl !== '#' && (
                            <a
                              href={viewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-secondary btn-sm"
                              title="Lihat file"
                            >
                              <ExternalLink size={13} />
                              <span>Lihat</span>
                            </a>
                          )}
                          {dlUrl !== '#' && (
                            <a
                              href={dlUrl}
                              className="btn btn-secondary btn-sm"
                              title="Unduh file"
                              download={displayName(f.name)}
                            >
                              <Download size={13} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
