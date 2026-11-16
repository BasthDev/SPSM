import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Search, FileText, ChevronRight, X, ExternalLink, Clock,
  CheckCircle2, XCircle, Pencil, Upload, Eye,
} from 'lucide-react';
import { useAuth } from '@/app/auth';
import { submissionService } from '@/services/submissionService';
import { lecturerService } from '@/services/lecturerService';
import { masterDataService } from '@/services/masterDataService';
import { apiClient } from '@/services/apiClient';
import { mapSubmission } from '@/lib/mappers';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Textarea } from '@/components/ui';
import { statusMeta, formatDateShort } from '@/lib/format';
import type { ThesisSubmission } from '@/types';

const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'pending_lecturer', label: 'Menunggu Dosen' },
  { value: 'waiting_kaprodi', label: 'Menunggu Kaprodi' },
  { value: 'waiting_akademik', label: 'Menunggu Akademik' },
  { value: 'sk_process', label: 'Proses SK' },
  { value: 'sk_issued', label: 'SK Terbit' },
  { value: 'rejected', label: 'Ditolak' },
  { value: 'revision', label: 'Revisi' },
];

export function SubmissionsView() {
  const { user } = useAuth();
  const role = user?.role || 'lecturer';
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const statusFilter = params.get('status') || 'all';
  const openId = params.get('open');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [selected, setSelected] = useState<ThesisSubmission | null>(null);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['submissions', 'all'],
    queryFn: () => submissionService.getAllSubmissions(),
  });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => masterDataService.getDepartments() });
  const { data: lecturers = [] } = useQuery({ queryKey: ['lecturers'], queryFn: () => lecturerService.getLecturers() });

  const lecturerId = user?.lecturer?.$id;

  const filtered = useMemo(() => {
    let list = submissions;
    // Dosen hanya melihat bimbingannya
    if (role === 'lecturer' && lecturerId) {
      list = list.filter((s) => {
        const ids = [s.advisor?.$id || (s as any).advisor1_id, (s as any).advisor2_id].filter(Boolean).map(String);
        return ids.includes(lecturerId);
      });
    }
    if (statusFilter !== 'all') {
      // 'approved' web ≈ 'sk_issued' backend — mapper sudah menormalkan
      list = list.filter((s) => s.status === statusFilter || (statusFilter === 'sk_issued' && s.status === 'approved'));
    }
    if (deptFilter !== 'all') {
      list = list.filter((s) => (s.student?.department || '') === deptFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        [s.student?.name, s.student?.nim_or_nip, s.student?.email]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) =>
      String(b.$createdAt || b.submitted_at || '').localeCompare(String(a.$createdAt || a.submitted_at || ''))
    );
  }, [submissions, role, lecturerId, statusFilter, deptFilter, search]);

  const setStatus = (v: string) => {
    const p = new URLSearchParams(params);
    if (v === 'all') p.delete('status'); else p.set('status', v);
    setParams(p, { replace: true });
  };

  const openDetail = async (sub: ThesisSubmission) => {
    setSelected(sub);
    // hydrate detail (options, logs) bila list tidak menyertakannya
    try {
      const full = await apiClient.submissions.getById(sub.$id);
      setSelected(mapSubmission(full));
    } catch { /* biarkan data list */ }
  };

  // auto-open dari dashboard (?open=id)
  const autoOpened = useMemo(() => submissions.find((s) => s.$id === openId), [submissions, openId]);
  const [autoTried, setAutoTried] = useState(false);
  if (autoOpened && !selected && !autoTried) {
    setAutoTried(true);
    void openDetail(autoOpened);
    const p = new URLSearchParams(params);
    p.delete('open');
    setParams(p, { replace: true });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink-900">Pengajuan Skripsi</h1>
        <p className="mt-0.5 text-[13px] text-ink-500">{filtered.length} pengajuan ditampilkan</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatus(t.value)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
                statusFilter === t.value
                  ? 'bg-brand-900 text-white shadow-sm'
                  : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="!w-44 !py-2 text-[13px]">
            <option value="all">Semua Prodi</option>
            {departments.map((d) => (
              <option key={d.$id} value={d.code || d.name}>{d.name}</option>
            ))}
          </Select>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / NIM…"
              className="!w-56 !py-2 pl-9 text-[13px]"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<FileText size={36} />} title="Tidak ada pengajuan" desc="Coba ubah filter atau kata kunci pencarian." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-[11px] font-extrabold uppercase tracking-wider text-ink-400">
                  <th className="px-5 py-3">Mahasiswa</th>
                  <th className="px-4 py-3">Prodi / Angkatan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Pembimbing</th>
                  <th className="px-4 py-3">Diajukan</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((sub) => {
                  const meta = statusMeta(sub.status);
                  return (
                    <tr key={sub.$id} className="transition-colors hover:bg-brand-50/40">
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-ink-900">{sub.student?.name || 'Mahasiswa'}</p>
                        <p className="text-[12px] text-ink-400">{sub.student?.nim_or_nip || '-'}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-ink-700">{sub.student?.department || '-'}</p>
                        <p className="text-[12px] text-ink-400">{sub.student?.batch_year || '-'}</p>
                      </td>
                      <td className="px-4 py-3.5"><Badge tone={meta.tone}>{meta.label}</Badge></td>
                      <td className="px-4 py-3.5 text-ink-600">
                        <p className="max-w-[180px] truncate">{sub.advisor?.name || sub.preferredAdvisor1?.name || '-'}</p>
                        {sub.advisor2?.name && <p className="max-w-[180px] truncate text-[11px] text-ink-400">+ {sub.advisor2.name}</p>}
                      </td>
                      <td className="px-4 py-3.5 text-ink-500">{formatDateShort(sub.$createdAt || sub.submitted_at)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <Button size="sm" variant="outline" onClick={() => openDetail(sub)}>
                          <Eye size={13} /> Detail
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Detail modal */}
      {selected && (
        <SubmissionDetailModal
          submission={selected}
          lecturers={lecturers}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            await qc.invalidateQueries({ queryKey: ['submissions'] });
            const full = await apiClient.submissions.getById(selected.$id).catch(() => null);
            if (full) setSelected(mapSubmission(full));
          }}
        />
      )}
    </div>
  );
}

/* ================= Detail Modal ================= */
function SubmissionDetailModal({
  submission: sub,
  lecturers,
  onClose,
  onChanged,
}: {
  submission: ThesisSubmission;
  lecturers: any[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { user } = useAuth();
  const role = user?.role || 'lecturer';
  const canAct = user?.isAdmin || ['admin', 'reviewer', 'kaprodi', 'akademik'].includes(role);
  const meta = statusMeta(sub.status);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Reviewer form
  const [selOption, setSelOption] = useState<string>('');
  const [adv1, setAdv1] = useState<string>(sub.advisor?.$id || (sub as any).advisor1_id || '');
  const [adv2, setAdv2] = useState<string>((sub as any).advisor2_id || '');
  const [notes, setNotes] = useState('');

  // Reject/revision form
  const [showReject, setShowReject] = useState<'reject' | 'revision' | null>(null);
  const [rejNotes, setRejNotes] = useState({ o1: '', o2: '', o3: '', general: '' });

  // SK upload
  const [skFile, setSkFile] = useState<File | null>(null);

  const run = async (fn: () => Promise<void>, okMsg: string) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await fn();
      setMsg(okMsg);
      await onChanged();
    } catch (e: any) {
      setErr(e.message || 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  };

  const opts = sub.options || [];
  const logs = [...(sub.logs || [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const lecturerName = (id?: string) => lecturers.find((l) => (l.$id || l.id) === id)?.name || id || '-';

  const canReview = canAct && sub.status === 'pending_lecturer';
  const canKaprodi = canAct && (user?.isAdmin || role === 'kaprodi' || role === 'admin') && sub.status === 'waiting_kaprodi';
  const canAkademik = canAct && (user?.isAdmin || role === 'akademik' || role === 'admin') && ['waiting_akademik', 'sk_process'].includes(sub.status);

  return (
    <Modal open onClose={onClose} wide title="Detail Pengajuan">
      <div className="space-y-5">
        {/* Header info */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-extrabold text-ink-900">{sub.student?.name || 'Mahasiswa'}</p>
            <p className="text-[13px] text-ink-500">
              {sub.student?.nim_or_nip || '-'} · {sub.student?.department || '-'} · Angkatan {sub.student?.batch_year || '-'}
            </p>
            {sub.student?.email && <p className="text-[12px] text-ink-400">{sub.student.email}</p>}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {sub.nomor_surat && <p className="text-[12px] font-bold text-ink-600">No. {sub.nomor_surat}</p>}
            <p className="text-[11px] text-ink-400">Diajukan {formatDateShort(sub.$createdAt || sub.submitted_at)}</p>
          </div>
        </div>

        {msg && <div className="rounded-lg bg-emerald-50 px-4 py-2.5 text-[13px] font-semibold text-emerald-700">{msg}</div>}
        {err && <div className="rounded-lg bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-600">{err}</div>}

        {/* Options */}
        <div>
          <p className="mb-2 text-[12px] font-extrabold uppercase tracking-wider text-ink-400">Opsi Judul ({opts.length})</p>
          <div className="space-y-2.5">
            {opts.length === 0 && <p className="text-[13px] text-ink-400">Tidak ada opsi judul.</p>}
            {opts.map((o) => (
              <div
                key={o.$id}
                className={`rounded-xl border p-3.5 ${
                  o.is_selected_by_lecturer ? 'border-emerald-400 bg-emerald-50/50' : 'border-ink-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-900 text-[10px] font-extrabold text-white">
                        {o.option_number}
                      </span>
                      <p className="text-[13.5px] font-bold text-ink-900">{o.title}</p>
                      {o.is_selected_by_lecturer && <Badge tone="green">Terpilih</Badge>}
                    </div>
                    {o.background && <p className="mt-1.5 line-clamp-2 text-[12.5px] text-ink-500">{o.background}</p>}
                    {(o.journal_title || o.journal_author) && (
                      <p className="mt-1 text-[11.5px] italic text-ink-400">
                        Referensi: {o.journal_title} {o.journal_author ? `— ${o.journal_author}` : ''} {o.journal_year ? `(${o.journal_year})` : ''}
                      </p>
                    )}
                    {o.revision_note && (
                      <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] font-medium text-amber-700">
                        Catatan revisi: {o.revision_note}
                      </p>
                    )}
                  </div>
                  {o.journal_file_id && (
                    <a
                      href={apiClient.files.getViewUrl('journals', o.journal_file_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-700 hover:bg-brand-50"
                    >
                      <ExternalLink size={12} /> Jurnal
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Advisors */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-ink-200 p-3.5">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-400">Pembimbing 1</p>
            <p className="mt-1 text-[13.5px] font-bold text-ink-800">{sub.advisor?.name || lecturerName((sub as any).advisor1_id)}</p>
            {sub.advisor?.nip && <p className="text-[11.5px] text-ink-400">NIP {sub.advisor.nip}</p>}
          </div>
          <div className="rounded-xl border border-ink-200 p-3.5">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-400">Pembimbing 2</p>
            <p className="mt-1 text-[13.5px] font-bold text-ink-800">{sub.advisor2?.name || lecturerName((sub as any).advisor2_id)}</p>
            {sub.advisor2?.nip && <p className="text-[11.5px] text-ink-400">NIP {sub.advisor2.nip}</p>}
          </div>
        </div>

        {/* ===== ACTIONS ===== */}
        {canReview && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <p className="mb-3 flex items-center gap-2 text-[13px] font-extrabold text-blue-900">
              <CheckCircle2 size={15} /> Verifikasi Reviewer — Pilih Judul & Penetapan Pembimbing
            </p>
            <div className="space-y-3">
              <Field label="Pilih Opsi Judul">
                <Select value={selOption} onChange={(e) => setSelOption(e.target.value)}>
                  <option value="">— Pilih opsi —</option>
                  {opts.map((o) => (
                    <option key={o.$id} value={o.$id}>Opsi {o.option_number}: {o.title.slice(0, 60)}{o.title.length > 60 ? '…' : ''}</option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Dosen Pembimbing 1">
                  <Select value={adv1} onChange={(e) => setAdv1(e.target.value)}>
                    <option value="">— Pilih —</option>
                    {lecturers.map((l) => <option key={l.$id || l.id} value={l.$id || l.id}>{l.name}</option>)}
                  </Select>
                </Field>
                <Field label="Dosen Pembimbing 2">
                  <Select value={adv2} onChange={(e) => setAdv2(e.target.value)}>
                    <option value="">— Pilih —</option>
                    {lecturers.map((l) => <option key={l.$id || l.id} value={l.$id || l.id}>{l.name}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Catatan (opsional)">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan verifikasi…" />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  loading={busy}
                  disabled={!selOption}
                  onClick={() =>
                    run(
                      () => submissionService.reviewAndSelectTitle(sub.$id, selOption, adv1, adv2, user?.account?.name || 'Reviewer', notes),
                      'Judul & pembimbing ditetapkan. Status → Menunggu Kaprodi.'
                    )
                  }
                >
                  <CheckCircle2 size={15} /> Setujui & Tetapkan
                </Button>
                <Button variant="outline" onClick={() => setShowReject(showReject === 'revision' ? null : 'revision')}>
                  <Pencil size={14} /> Minta Revisi
                </Button>
                <Button variant="danger" onClick={() => setShowReject(showReject === 'reject' ? null : 'reject')}>
                  <XCircle size={14} /> Tolak
                </Button>
              </div>
            </div>
          </div>
        )}

        {canKaprodi && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
            <p className="mb-3 flex items-center gap-2 text-[13px] font-extrabold text-violet-900">
              <CheckCircle2 size={15} /> Validasi Kaprodi — Pengesahan Akhir
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dosen Pembimbing 1 (bisa diubah)">
                <Select value={adv1} onChange={(e) => setAdv1(e.target.value)}>
                  {lecturers.map((l) => <option key={l.$id || l.id} value={l.$id || l.id}>{l.name}</option>)}
                </Select>
              </Field>
              <Field label="Dosen Pembimbing 2 (bisa diubah)">
                <Select value={adv2} onChange={(e) => setAdv2(e.target.value)}>
                  <option value="">— Tidak ada —</option>
                  {lecturers.map((l) => <option key={l.$id || l.id} value={l.$id || l.id}>{l.name}</option>)}
                </Select>
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Catatan Kaprodi">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan pengesahan…" />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                loading={busy}
                onClick={() =>
                  run(async () => {
                    // Flow web_app: kaprodi → waiting_akademik (SK belum terbit)
                    await apiClient.submissions.updateStatus(
                      sub.$id, 'waiting_akademik', 'DISAHKAN_KAPRODI',
                      notes || 'Judul dan Dosen Pembimbing disahkan Kaprodi. Menunggu administrasi SK.',
                      { advisor1Id: adv1 || null, advisor2Id: adv2 || null, kaprodiNotes: notes || null }
                    );
                  }, 'Disahkan Kaprodi → Menunggu Administrasi Akademik.')
                }
              >
                <CheckCircle2 size={15} /> Sahkan (lanjut ke Akademik)
              </Button>
              <Button variant="outline" onClick={() => setShowReject(showReject === 'revision' ? null : 'revision')}>
                <Pencil size={14} /> Revisi
              </Button>
              <Button variant="danger" onClick={() => setShowReject(showReject === 'reject' ? null : 'reject')}>
                <XCircle size={14} /> Tolak
              </Button>
            </div>
          </div>
        )}

        {canAkademik && (
          <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-4">
            <p className="mb-3 flex items-center gap-2 text-[13px] font-extrabold text-cyan-900">
              <Upload size={15} /> Administrasi SK — Unggah Scan SK BertTD
            </p>
            {sub.nomor_surat && (
              <p className="mb-3 rounded-lg bg-white px-3 py-2 text-[12.5px] font-bold text-ink-700 ring-1 ring-ink-200">
                Nomor Surat: {sub.nomor_surat}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setSkFile(e.target.files?.[0] || null)}
                className="text-[13px] text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-900 file:px-3.5 file:py-2 file:text-[12.5px] file:font-bold file:text-white hover:file:bg-brand-800"
              />
              <Button
                loading={busy}
                disabled={!skFile}
                onClick={() =>
                  run(async () => {
                    const uploaded = await apiClient.files.upload('sk', skFile!);
                    const fileId = uploaded.fileId || uploaded.id;
                    await apiClient.submissions.updateStatus(
                      sub.$id, 'sk_issued', 'SK_RESMI_TERBIT',
                      `Scan PDF SK resmi berhasil diunggah (File ID: ${fileId}). SK resmi diterbitkan.`,
                      { scannedSkId: fileId }
                    );
                  }, 'SK resmi berhasil diterbitkan.')
                }
              >
                <Upload size={14} /> Unggah & Terbitkan SK
              </Button>
            </div>
          </div>
        )}

        {/* Reject / revision form */}
        {showReject && (canReview || canKaprodi) && (
          <div className={`rounded-xl border p-4 ${showReject === 'reject' ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
            <p className={`mb-3 text-[13px] font-extrabold ${showReject === 'reject' ? 'text-red-800' : 'text-amber-800'}`}>
              {showReject === 'reject' ? 'Tolak Pengajuan' : 'Minta Revisi'} — catatan per opsi judul
            </p>
            {opts.map((o) => (
              <Field key={o.$id} label={`Opsi ${o.option_number}: ${o.title.slice(0, 50)}${o.title.length > 50 ? '…' : ''}`}>
                <Input
                  value={showReject === 'reject' ? rejNotes.o1 && o.option_number === 1 ? rejNotes.o1 : rejNotes[`o${o.option_number}` as keyof typeof rejNotes] as string : (rejNotes as any)[`o${o.option_number}`] || ''}
                  onChange={(e) => setRejNotes((p) => ({ ...p, [`o${o.option_number}`]: e.target.value }))}
                  placeholder="Catatan untuk opsi ini…"
                />
              </Field>
            ))}
            <div className="mt-2">
              <Field label="Catatan umum (opsional)">
                <Textarea value={rejNotes.general} onChange={(e) => setRejNotes((p) => ({ ...p, general: e.target.value }))} />
              </Field>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant={showReject === 'reject' ? 'danger' : 'primary'}
                loading={busy}
                onClick={() =>
                  run(async () => {
                    const actor = user?.account?.name || 'Staff';
                    const fn = showReject === 'reject' ? submissionService.rejectSubmission : submissionService.requestRevision;
                    await fn(sub.$id, actor, rejNotes.o1, rejNotes.o2, rejNotes.o3, rejNotes.general);
                  }, showReject === 'reject' ? 'Pengajuan ditolak.' : 'Revisi diminta.')
                }
              >
                {showReject === 'reject' ? 'Konfirmasi Tolak' : 'Kirim Permintaan Revisi'}
              </Button>
              <Button variant="ghost" onClick={() => setShowReject(null)}>Batal</Button>
            </div>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-wider text-ink-400">
              <Clock size={12} /> Riwayat Persetujuan ({logs.length})
            </p>
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.$id} className="flex gap-3 rounded-lg border border-ink-100 bg-ink-50/50 px-3.5 py-2.5">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-bold text-ink-800">{log.action}</p>
                    {log.notes && <p className="mt-0.5 whitespace-pre-wrap text-[12px] text-ink-500">{log.notes}</p>}
                    <p className="mt-0.5 text-[11px] text-ink-400">
                      {log.actor_id} · {formatDateShort(log.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end border-t border-ink-100 pt-3">
          <Button variant="outline" onClick={onClose}><X size={14} /> Tutup</Button>
        </div>
      </div>
    </Modal>
  );
}
