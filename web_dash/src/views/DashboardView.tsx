import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Clock, CheckCircle2, XCircle, Pencil, ArrowRight,
  Users, GraduationCap, FolderOpen,
} from 'lucide-react';
import { useAuth } from '@/app/auth';
import { submissionService } from '@/services/submissionService';
import { settingsService } from '@/services/settingsService';
import { Card, CardHeader, Badge, Spinner, EmptyState } from '@/components/ui';
import { formatDateShort, statusMeta } from '@/lib/format';
import { lecturerPositionOn, submissionInvolvesLecturer, LECTURER_POSITION_LABEL, type LecturerPosition } from '@/lib/lecturerRole';
import type { ThesisSubmission, SubmissionStatus } from '@/types';


function StatCard({ icon, label, value, tone, onClick }: { icon: React.ReactNode; label: string; value: number; tone: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-4 rounded-xl border border-ink-200 bg-white p-4 text-left shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-md ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold leading-none text-ink-900">{value}</p>
        <p className="mt-1 truncate text-[12px] font-semibold text-ink-500">{label}</p>
      </div>
    </button>
  );
}

export function DashboardView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || 'lecturer';
  const lecturerId = user?.lecturer?.$id;

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['submissions', 'all'],
    queryFn: () => submissionService.getAllSubmissions(),
  });
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsService.getSettings(),
  });

  // Untuk dosen: pengajuan yang dia bimbingi ATAU yang memilihnya sebagai pembimbing
  const visible =
    role === 'lecturer' && lecturerId
      ? submissions.filter((s) => submissionInvolvesLecturer(s, lecturerId))
      : submissions;

  const assigned = (st?: ThesisSubmission['status']) =>
    visible.filter(
      (s) =>
        (!st || s.status === st) &&
        ['advisor1', 'advisor2'].includes(lecturerPositionOn(s, lecturerId) || '')
    );
  const preferredOnly = visible.filter(
    (s) => ['pref1', 'pref2'].includes(lecturerPositionOn(s, lecturerId) || '')
  );

  const count = (st: SubmissionStatus | SubmissionStatus[]) =>
    visible.filter((s) => (Array.isArray(st) ? st.includes(s.status) : s.status === st)).length;

  const stats =
    role === 'reviewer'
      ? [
          { label: 'Menunggu Review', value: count('pending_lecturer'), icon: <Clock size={20} className="text-blue-600" />, tone: 'bg-blue-50', status: 'pending_lecturer' as const },
          { label: 'Menunggu Kaprodi', value: count('waiting_kaprodi'), icon: <FileText size={20} className="text-violet-600" />, tone: 'bg-violet-50', status: 'waiting_kaprodi' as const },
          { label: 'Disetujui', value: count(['approved', 'sk_issued'] as any), icon: <CheckCircle2 size={20} className="text-emerald-600" />, tone: 'bg-emerald-50', status: 'approved' as const },
          { label: 'Ditolak/Revisi', value: count(['rejected', 'revision'] as any), icon: <XCircle size={20} className="text-red-500" />, tone: 'bg-red-50', status: 'rejected' as const },
        ]
      : role === 'kaprodi'
      ? [
          { label: 'Antrian Validasi', value: count('waiting_kaprodi'), icon: <Clock size={20} className="text-violet-600" />, tone: 'bg-violet-50', status: 'waiting_kaprodi' as const },
          { label: 'Proses SK', value: count(['waiting_akademik', 'sk_process'] as any), icon: <FileText size={20} className="text-cyan-600" />, tone: 'bg-cyan-50', status: 'sk_process' as const },
          { label: 'SK Terbit', value: count(['approved', 'sk_issued'] as any), icon: <CheckCircle2 size={20} className="text-emerald-600" />, tone: 'bg-emerald-50', status: 'approved' as const },
          { label: 'Total Disetujui', value: submissionService.calculateTotalVerified(visible), icon: <GraduationCap size={20} className="text-brand-700" />, tone: 'bg-brand-50', status: 'approved' as const },
        ]
      : role === 'akademik'
      ? [
          { label: 'Menunggu Akademik', value: count('waiting_akademik'), icon: <Clock size={20} className="text-cyan-600" />, tone: 'bg-cyan-50', status: 'waiting_akademik' as const },
          { label: 'Proses Penerbitan SK', value: count('sk_process'), icon: <FileText size={20} className="text-amber-600" />, tone: 'bg-amber-50', status: 'sk_process' as const },
          { label: 'SK Terbit', value: count(['approved', 'sk_issued'] as any), icon: <CheckCircle2 size={20} className="text-emerald-600" />, tone: 'bg-emerald-50', status: 'approved' as const },
          { label: 'Total Pengajuan', value: visible.length, icon: <Users size={20} className="text-brand-700" />, tone: 'bg-brand-50', status: undefined },
        ]
      : role === 'lecturer'
      ? [
          { label: 'Bimbingan Saya', value: assigned().length, icon: <Users size={20} className="text-brand-700" />, tone: 'bg-brand-50', status: undefined },
          { label: 'Dipilih Mahasiswa', value: preferredOnly.length, icon: <GraduationCap size={20} className="text-cyan-600" />, tone: 'bg-cyan-50', status: undefined },
          { label: 'Menunggu Proses', value: visible.filter((s) => ['pending_lecturer', 'waiting_kaprodi', 'waiting_akademik', 'sk_process'].includes(s.status)).length, icon: <Clock size={20} className="text-amber-600" />, tone: 'bg-amber-50', status: undefined },
          { label: 'Selesai / SK Terbit', value: visible.filter((s) => ['approved', 'sk_issued'].includes(s.status)).length, icon: <CheckCircle2 size={20} className="text-emerald-600" />, tone: 'bg-emerald-50', status: 'approved' as const },
        ]
      : [
          { label: 'Total Pengajuan', value: visible.length, icon: <FileText size={20} className="text-brand-700" />, tone: 'bg-brand-50', status: undefined },
          { label: 'Menunggu Proses', value: count(['pending_lecturer', 'waiting_kaprodi', 'waiting_akademik', 'sk_process'] as any), icon: <Clock size={20} className="text-amber-600" />, tone: 'bg-amber-50', status: undefined },
          { label: 'Selesai / SK Terbit', value: count(['approved', 'sk_issued'] as any), icon: <CheckCircle2 size={20} className="text-emerald-600" />, tone: 'bg-emerald-50', status: 'approved' as const },
          { label: 'Ditolak / Revisi', value: count(['rejected', 'revision'] as any), icon: <XCircle size={20} className="text-red-500" />, tone: 'bg-red-50', status: 'rejected' as const },
        ];

  const recent = [...visible]
    .sort((a, b) => String(b.$createdAt || b.submitted_at || '').localeCompare(String(a.$createdAt || a.submitted_at || '')))
    .slice(0, 6);

  const periodOpen = settings?.is_active;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink-900">Dashboard</h1>
          <p className="mt-0.5 text-[13px] text-ink-500">
            Ringkasan pengajuan skripsi{settings?.academic_year ? ` — ${settings.academic_year}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={periodOpen ? 'green' : 'red'}>
            {periodOpen ? 'Periode Buka' : 'Periode Tutup'}
          </Badge>
          <button
            onClick={() => navigate('/submissions')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-900 px-3.5 py-2 text-[13px] font-bold text-white hover:bg-brand-800"
          >
            Semua Pengajuan <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {stats.map((s) => (
            <StatCard
              key={s.label}
              icon={s.icon}
              label={s.label}
              value={s.value}
              tone={s.tone}
              onClick={s.status ? () => navigate(`/submissions?status=${s.status}`) : undefined}
            />
          ))}
        </div>
      )}

      {/* Recent submissions */}
      <Card>
        <CardHeader
          title="Pengajuan Terbaru"
          subtitle="6 pengajuan terakhir"
          action={
            <button onClick={() => navigate('/submissions')} className="text-[13px] font-bold text-brand-700 hover:text-brand-800">
              Lihat semua →
            </button>
          }
        />
        {recent.length === 0 ? (
          <EmptyState icon={<FolderOpen size={36} />} title="Belum ada pengajuan" desc="Pengajuan mahasiswa akan muncul di sini." />
        ) : (
          <div className="divide-y divide-ink-100">
            {recent.map((sub) => {
              const meta = statusMeta(sub.status);
              const pos: LecturerPosition | null =
                role === 'lecturer' ? lecturerPositionOn(sub, lecturerId) : null;
              return (
                <button
                  key={sub.$id}
                  onClick={() => navigate(`/submissions?open=${sub.$id}`)}
                  className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-ink-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13.5px] font-bold text-ink-900">
                        {sub.student?.name || 'Mahasiswa'}
                      </p>
                      {pos && (
                        <Badge tone={pos === 'advisor1' || pos === 'advisor2' ? 'blue' : 'slate'} className="shrink-0">
                          {LECTURER_POSITION_LABEL[pos]}
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-[12px] text-ink-400">
                      {sub.student?.nim_or_nip || '-'} · {sub.student?.department || '-'}
                    </p>
                  </div>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <span className="hidden w-24 text-right text-[12px] text-ink-400 sm:block">
                    {formatDateShort(sub.$createdAt || sub.submitted_at)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
