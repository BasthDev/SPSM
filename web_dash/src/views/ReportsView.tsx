import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Users, GraduationCap, CheckCircle2, XCircle, FileCheck } from 'lucide-react';
import { submissionService } from '@/services/submissionService';
import { lecturerService } from '@/services/lecturerService';
import { masterDataService } from '@/services/masterDataService';
import { Card, CardHeader, EmptyState, Select, Spinner, Badge } from '@/components/ui';
import { statusMeta, formatDateShort } from '@/lib/format';
import { APPROVED_STATUSES } from '@/lib/constants';

export function ReportsView() {
  const [tab, setTab] = useState<'lecturers' | 'students'>('lecturers');
  const [deptFilter, setDeptFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data: submissions = [], isLoading: ls } = useQuery({ queryKey: ['submissions', 'all'], queryFn: () => submissionService.getAllSubmissions() });
  const { data: lecturers = [], isLoading: ll } = useQuery({ queryKey: ['lecturers'], queryFn: () => lecturerService.getLecturers() });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => masterDataService.getDepartments() });
  const isLoading = ls || ll;

  const deptName = (code?: string) => {
    if (!code) return '-';
    return departments.find((d) => d.code === code || d.name === code)?.name || code;
  };

  // ---- Laporan Dosen ----
  const lecturerStats = useMemo(() => {
    return lecturers
      .map((l) => {
        const adviseeSubs = submissions.filter((s) => {
          const ids = [s.advisor?.$id || (s as any).advisor1_id, (s as any).advisor2_id].filter(Boolean).map(String);
          return ids.includes(l.$id);
        });
        const approved = adviseeSubs.filter((s) => APPROVED_STATUSES.has(s.status) || s.status === 'waiting_kaprodi').length;
        const rejected = adviseeSubs.filter((s) => s.status === 'rejected').length;
        const pending = adviseeSubs.filter((s) => ['pending_lecturer', 'revision', 'drafting'].includes(s.status)).length;
        const hist = l.rejection_history || [];
        const now = Date.now();
        const weekAgo = now - 7 * 864e5;
        const monthAgo = now - 30 * 864e5;
        const declinedWeek = hist.filter((h) => new Date(h.at).getTime() > weekAgo).length;
        const declinedMonth = hist.filter((h) => new Date(h.at).getTime() > monthAgo).length;
        return { lecturer: l, total: adviseeSubs.length, approved, rejected, pending, declined: l.rejected_assignments ?? hist.length, declinedWeek, declinedMonth };
      })
      .filter((r) => {
        if (deptFilter !== 'all' && (r.lecturer.department_id || '') !== deptFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return [r.lecturer.name, r.lecturer.nip].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
        }
        return true;
      })
      .sort((a, b) => b.total - a.total);
  }, [lecturers, submissions, deptFilter, search]);

  // ---- Laporan Mahasiswa Lulus ----
  const graduated = useMemo(() => {
    return submissions
      .filter((s) => APPROVED_STATUSES.has(s.status) || s.status === 'sk_issued')
      .filter((s) => {
        const dept = s.student?.department || '';
        if (deptFilter !== 'all' && dept !== deptFilter && deptName(dept) !== departments.find((d) => d.$id === deptFilter)?.name) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return [s.student?.name, s.student?.nim_or_nip].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
        }
        return true;
      })
      .sort((a, b) => String(b.$createdAt || '').localeCompare(String(a.$createdAt || '')));
  }, [submissions, deptFilter, search, departments]);

  const totals = useMemo(() => ({
    lecturers: lecturers.length,
    approved: submissions.filter((s) => APPROVED_STATUSES.has(s.status) || s.status === 'sk_issued').length,
    rejected: submissions.filter((s) => s.status === 'rejected').length,
  }), [lecturers, submissions]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink-900">Laporan</h1>
        <p className="mt-0.5 text-[13px] text-ink-500">Statistik dosen & mahasiswa yang menyelesaikan skripsi</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Total Dosen', value: totals.lecturers, icon: <Users size={20} className="text-brand-700" />, bg: 'bg-brand-50' },
          { label: 'SK Terbit / Lulus', value: totals.approved, icon: <GraduationCap size={20} className="text-emerald-600" />, bg: 'bg-emerald-50' },
          { label: 'Ditolak', value: totals.rejected, icon: <XCircle size={20} className="text-red-500" />, bg: 'bg-red-50' },
          { label: 'Total Pengajuan', value: submissions.length, icon: <FileCheck size={20} className="text-cyan-600" />, bg: 'bg-cyan-50' },
        ].map((c) => (
          <div key={c.label} className="flex items-center gap-4 rounded-xl border border-ink-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.bg}`}>{c.icon}</div>
            <div><p className="text-2xl font-extrabold text-ink-900">{c.value}</p><p className="text-[12px] font-semibold text-ink-500">{c.label}</p></div>
          </div>
        ))}
      </div>

      {/* Tabs + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {([['lecturers', 'Performa Dosen'], ['students', 'Mahasiswa Lulus']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`rounded-lg px-3.5 py-2 text-[13px] font-bold transition-colors ${tab === v ? 'bg-brand-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="!w-44 !py-2 text-[13px]">
            <option value="all">Semua Prodi</option>
            {departments.map((d) => <option key={d.$id} value={d.code || d.name}>{d.name}</option>)}
          </Select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari…"
            className="w-52 rounded-lg border border-ink-300 bg-white px-3.5 py-2 text-[13px] focus:border-brand-600 focus:outline-none" />
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : tab === 'lecturers' ? (
          lecturerStats.length === 0 ? <EmptyState icon={<Users size={36} />} title="Tidak ada data dosen" /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50/60 text-[11px] font-extrabold uppercase tracking-wider text-ink-400">
                    <th className="px-5 py-3">Dosen</th><th className="px-4 py-3">Prodi</th>
                    <th className="px-4 py-3">Total Bimbingan</th><th className="px-4 py-3">Disetujui</th>
                    <th className="px-4 py-3">Ditolak</th><th className="px-4 py-3">Tolak Assign</th>
                    <th className="px-4 py-3">Minggu Ini</th><th className="px-4 py-3">Bulan Ini</th><th className="px-4 py-3">Dalam Proses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {lecturerStats.map((r) => (
                    <tr key={r.lecturer.$id} className="hover:bg-ink-50/60">
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-ink-900">{r.lecturer.name}</p>
                        <p className="text-[12px] text-ink-400">{r.lecturer.nip || r.lecturer.email}</p>
                      </td>
                      <td className="px-4 py-3.5 text-ink-600">{deptName(r.lecturer.department_id || r.lecturer.department)}</td>
                      <td className="px-4 py-3.5 font-bold text-ink-900">{r.total}</td>
                      <td className="px-4 py-3.5"><Badge tone="green">{r.approved}</Badge></td>
                      <td className="px-4 py-3.5"><Badge tone="red">{r.rejected}</Badge></td>
                      <td className="px-4 py-3.5">
                        <Badge
                          tone={r.declined > 0 ? 'amber' : 'slate'}
                          className="cursor-help"
                        >
                          {r.declined}
                        </Badge>
                        {r.lecturer.rejection_history?.[0] && (
                          <p className="mt-0.5 max-w-[140px] truncate text-[10.5px] text-ink-400" title={r.lecturer.rejection_history[0].reason || ''}>
                            terakhir {formatDateShort(r.lecturer.rejection_history[0].at)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5"><Badge tone={r.declinedWeek > 0 ? 'red' : 'slate'}>{r.declinedWeek}</Badge></td>
                      <td className="px-4 py-3.5"><Badge tone={r.declinedMonth > 0 ? 'amber' : 'slate'}>{r.declinedMonth}</Badge></td>
                      <td className="px-4 py-3.5"><Badge tone="amber">{r.pending}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : graduated.length === 0 ? (
          <EmptyState icon={<GraduationCap size={36} />} title="Belum ada mahasiswa lulus" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-[11px] font-extrabold uppercase tracking-wider text-ink-400">
                  <th className="px-5 py-3">Mahasiswa</th><th className="px-4 py-3">NIM</th>
                  <th className="px-4 py-3">Prodi</th><th className="px-4 py-3">Pembimbing</th>
                  <th className="px-4 py-3">Status</th><th className="px-4 py-3">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {graduated.map((s) => {
                  const meta = statusMeta(s.status);
                  return (
                    <tr key={s.$id} className="hover:bg-ink-50/60">
                      <td className="px-5 py-3.5 font-bold text-ink-900">{s.student?.name || '-'}</td>
                      <td className="px-4 py-3.5 text-ink-600">{s.student?.nim_or_nip || '-'}</td>
                      <td className="px-4 py-3.5 text-ink-600">{s.student?.department || '-'}</td>
                      <td className="px-4 py-3.5 text-ink-600">{s.advisor?.name || '-'}</td>
                      <td className="px-4 py-3.5"><Badge tone={meta.tone}>{meta.label}</Badge></td>
                      <td className="px-4 py-3.5 text-ink-500">{formatDateShort(s.$createdAt || s.submitted_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
