import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Search, Download, ExternalLink, FileText, Image as ImageIcon, FileSpreadsheet } from 'lucide-react';
import { storageService, type RepoFile } from '@/services/storageService';
import { Badge, Card, EmptyState, Input, Spinner } from '@/components/ui';
import { formatDateShort } from '@/lib/format';

function fileIcon(mime?: string) {
  if (mime?.includes('pdf')) return <FileText size={22} className="text-red-500" />;
  if (mime?.startsWith('image/')) return <ImageIcon size={22} className="text-blue-500" />;
  if (mime?.includes('sheet') || mime?.includes('excel')) return <FileSpreadsheet size={22} className="text-emerald-600" />;
  return <FileText size={22} className="text-ink-400" />;
}

function formatSize(bytes?: number) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RepoView() {
  const [search, setSearch] = useState('');
  const { data: files = [], isLoading } = useQuery({
    queryKey: ['repo-files'],
    queryFn: () => storageService.listAllFiles(),
  });

  // Filter file referensi opsi judul (refopt_*) — bukan dokumen repository
  const repoFiles = useMemo(
    () => files.filter((f) => !/^refopt_/i.test((f.name || '').replace(/^owner_[^_]+__/, ''))),
    [files]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return repoFiles;
    const q = search.toLowerCase();
    return repoFiles.filter((f) => (f.name || '').toLowerCase().includes(q));
  }, [repoFiles, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink-900">Repository</h1>
          <p className="mt-0.5 text-[13px] text-ink-500">{filtered.length} file dokumen & jurnal</p>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama file…" className="!w-64 !py-2 pl-9 text-[13px]" />
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={36} />}
            title={repoFiles.length === 0 ? 'Repository masih kosong' : 'Tidak ada file cocok'}
            desc={repoFiles.length === 0 ? 'File jurnal & dokumen mahasiswa akan tampil di sini.' : 'Coba kata kunci lain.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-[11px] font-extrabold uppercase tracking-wider text-ink-400">
                  <th className="px-5 py-3">File</th>
                  <th className="px-4 py-3">Ukuran</th>
                  <th className="px-4 py-3">Diunggah</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((f) => (
                  <tr key={f.$id} className="hover:bg-ink-50/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {fileIcon(f.mimeType)}
                        <div className="min-w-0">
                          <p className="max-w-[380px] truncate font-semibold text-ink-800" title={f.name}>{f.name}</p>
                          {f.mimeType && <p className="text-[11px] text-ink-400">{f.mimeType}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-500">{formatSize(f.sizeOriginal)}</td>
                    <td className="px-4 py-3 text-ink-500">{formatDateShort(f.$createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <a
                          href={storageService.getFileViewUrl(f.$id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-700 hover:bg-brand-50"
                        >
                          <ExternalLink size={12} /> Lihat
                        </a>
                        <a
                          href={storageService.getFileDownloadUrl(f.$id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand-900 px-2.5 py-1.5 text-[11.5px] font-bold text-white hover:bg-brand-800"
                        >
                          <Download size={12} /> Unduh
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
