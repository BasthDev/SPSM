import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings2, CalendarClock, FileSignature, Save, Info } from 'lucide-react';
import { settingsService } from '@/services/settingsService';
import { Button, Card, CardHeader, Field, Input, Spinner } from '@/components/ui';

export function SettingsView() {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const { data: settings, isLoading } = useQuery({ queryKey: ['settings'], queryFn: () => settingsService.getSettings() });

  useEffect(() => {
    if (settings) {
      setForm({
        is_active: settings.is_active,
        academic_year: settings.academic_year,
        required_title_count: settings.required_title_count,
        start_date: settings.start_date ? String(settings.start_date).slice(0, 16) : '',
        end_date: settings.end_date ? String(settings.end_date).slice(0, 16) : '',
        min_sks: settings.min_sks ?? 0,
        required_courses: (settings.required_courses || []).join('\n'),
      });
    }
  }, [settings]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await settingsService.updateSettings({
        is_active: !!form.is_active,
        academic_year: form.academic_year || settings?.academic_year,
        required_title_count: Number(form.required_title_count) || settings?.required_title_count,
        start_date: form.start_date,
        end_date: form.end_date,
        min_sks: Number(form.min_sks) || 0,
        required_courses: String(form.required_courses || '').split('\n').map((s: string) => s.trim()).filter(Boolean),
      } as any);
      setMsg({ type: 'ok', text: 'Pengaturan berhasil disimpan.' });
      qc.invalidateQueries({ queryKey: ['settings'] });
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message || 'Gagal menyimpan.' });
    } finally {
      setSaving(false);
    }
  };

  const status = settingsService.isPeriodOpen(settings as any);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner /></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink-900">Pengaturan Sistem</h1>
        <p className="mt-0.5 text-[13px] text-ink-500">Periode pengajuan & aturan skripsi</p>
      </div>

      {msg && (
        <div className={`rounded-xl border px-4 py-3 text-[13px] font-semibold ${msg.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'}`}>
          {msg.text}
        </div>
      )}

      <Card>
        <CardHeader icon={<Settings2 size={18} className="text-brand-700" />} title="Status Pengajuan" subtitle="Kontrol apakah mahasiswa dapat mengajukan judul" />
        <div className="px-5 py-5">
        <div className="flex items-center justify-between rounded-xl border border-ink-200 p-4">
          <div>
            <p className="text-[14px] font-bold text-ink-900">{status.isOpen ? 'Periode pengajuan AKTIF' : 'Periode pengajuan TUTUP'}</p>
            <p className="mt-0.5 text-[12px] text-ink-500">{status.reason || 'Mahasiswa dapat mengajukan judul baru saat ini.'}</p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="peer sr-only" />
            <div className="h-7 w-12 rounded-full bg-ink-200 peer-checked:bg-emerald-500 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:peer-checked:translate-x-5 after:shadow" />
          </label>
        </div>
        </div>
      </Card>

      <Card>
        <CardHeader icon={<CalendarClock size={18} className="text-brand-700" />} title="Periode & Tahun Akademik" />
        <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Tahun Akademik"><Input value={form.academic_year || ''} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} placeholder="2025/2026" /></Field>
          <Field label="Jumlah Judul Wajib"><Input type="number" min={1} max={5} value={form.required_title_count ?? ''} onChange={(e) => setForm({ ...form, required_title_count: Number(e.target.value) })} /></Field>
          <Field label="Mulai Pengajuan"><Input type="datetime-local" value={form.start_date || ''} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
          <Field label="Akhir Pengajuan"><Input type="datetime-local" value={form.end_date || ''} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
          <Field label="Minimal SKS"><Input type="number" value={form.min_sks ?? ''} onChange={(e) => setForm({ ...form, min_sks: Number(e.target.value) })} /></Field>
        </div>
      </Card>

      <Card>
        <CardHeader icon={<FileSignature size={18} className="text-brand-700" />} title="Mata Kuliah Wajib" subtitle="Satu per baris" />
        <div className="px-5 py-5">
        <textarea
          value={form.required_courses || ''}
          onChange={(e) => setForm({ ...form, required_courses: e.target.value })}
          rows={5}
          placeholder={'Basis Data\nPemrograman Web\nKecerdasan Buatan'}
          className="w-full rounded-xl border border-ink-300 px-4 py-3 text-[13px] focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        </div>
      </Card>

      <Card>
        <div className="flex items-start gap-3 px-5 py-5">
          <Info size={18} className="mt-0.5 shrink-0 text-ink-400" />
          <p className="text-[12.5px] leading-relaxed text-ink-500">
            Perubahan disimpan ke database dan <strong>langsung direaltime</strong> — aplikasi mobile mahasiswa akan menerima pembaruan tanpa perlu reload.
          </p>
        </div>
        <div className="flex justify-end border-t border-ink-100 px-5 py-4">
          <Button onClick={save} loading={saving}><Save size={15} /> Simpan Pengaturan</Button>
        </div>
      </Card>
    </div>
  );
}
