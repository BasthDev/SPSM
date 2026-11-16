import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { lecturerService } from '@/services/lecturerService';
import { masterDataService } from '@/services/masterDataService';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner } from '@/components/ui';
import type { Lecturer } from '@/types';

const ROLE_LABEL: Record<string, string> = {
  lecturer: 'Dosen Pembimbing', reviewer: 'Reviewer', kaprodi: 'Kaprodi', akademik: 'Akademik', admin: 'Admin',
};

export function LecturersView() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [modal, setModal] = useState<'create' | Lecturer | null>(null);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: lecturers = [], isLoading } = useQuery({ queryKey: ['lecturers'], queryFn: () => lecturerService.getLecturers() });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => masterDataService.getDepartments() });

  const filtered = useMemo(() => {
    let list = lecturers;
    if (deptFilter !== 'all') list = list.filter((l) => (l.department_id || l.department || '') === deptFilter || departments.find((d) => d.$id === deptFilter)?.name === l.department);
    if (roleFilter !== 'all') list = list.filter((l) => (l.role || 'lecturer') === roleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) => [l.name, l.nip, l.email].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
    }
    return list;
  }, [lecturers, deptFilter, roleFilter, search, departments]);

  const openCreate = () => {
    setForm({ name: '', nip: '', email: '', phone: '', department_id: '', expertise: '', quota: 10, role: 'lecturer', is_active: true });
    setErr(null);
    setModal('create');
  };
  const openEdit = (l: Lecturer) => {
    setForm({ ...l });
    setErr(null);
    setModal(l);
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (modal === 'create') await lecturerService.createLecturer(form);
      else await lecturerService.updateLecturer((modal as Lecturer).$id, form);
      await qc.invalidateQueries({ queryKey: ['lecturers'] });
      setModal(null);
    } catch (e: any) {
      setErr(e.message || 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (l: Lecturer) => {
    if (!confirm(`Hapus dosen ${l.name}?`)) return;
    await lecturerService.deleteLecturer(l.$id);
    await qc.invalidateQueries({ queryKey: ['lecturers'] });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink-900">Dosen & Pembimbing</h1>
          <p className="mt-0.5 text-[13px] text-ink-500">{filtered.length} dosen terdaftar</p>
        </div>
        <Button onClick={openCreate}><Plus size={15} /> Tambah Dosen</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="!w-48 !py-2 text-[13px]">
          <option value="all">Semua Prodi</option>
          {departments.map((d) => <option key={d.$id} value={d.$id}>{d.name}</option>)}
        </Select>
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="!w-40 !py-2 text-[13px]">
          <option value="all">Semua Role</option>
          {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <div className="relative ml-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / NIP / email…" className="!w-60 !py-2 pl-9 text-[13px]" />
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users size={36} />} title="Tidak ada dosen" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-[11px] font-extrabold uppercase tracking-wider text-ink-400">
                  <th className="px-5 py-3">Dosen</th>
                  <th className="px-4 py-3">NIP</th>
                  <th className="px-4 py-3">Prodi</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Mahasiswa</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((l) => (
                  <tr key={l.$id} className="hover:bg-ink-50/60">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-ink-900">{l.name}</p>
                      <p className="text-[12px] text-ink-400">{l.email}</p>
                    </td>
                    <td className="px-4 py-3.5 text-ink-600">{l.nip || '-'}</td>
                    <td className="px-4 py-3.5 text-ink-600">{departments.find((d) => d.$id === l.department_id)?.name || l.department_id || l.department || '-'}</td>
                    <td className="px-4 py-3.5"><Badge tone="blue">{ROLE_LABEL[l.role || 'lecturer'] || l.role}</Badge></td>
                    <td className="px-4 py-3.5 text-ink-600">{l.current_students ?? 0}/{l.quota ?? 10}</td>
                    <td className="px-4 py-3.5">
                      <Badge tone={l.is_active ? 'green' : 'red'}>{l.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => openEdit(l)} className="rounded-lg p-2 text-ink-400 hover:bg-brand-50 hover:text-brand-700"><Pencil size={15} /></button>
                        <button onClick={() => remove(l)} className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal === 'create' ? 'Tambah Dosen' : 'Edit Dosen'}>
        <div className="space-y-4">
          {err && <div className="rounded-lg bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-600">{err}</div>}
          <Field label="Nama Lengkap"><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="NIP"><Input value={form.nip || ''} onChange={(e) => setForm({ ...form, nip: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telepon"><Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Prodi">
              <Select value={form.department_id || ''} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                <option value="">— Pilih —</option>
                {departments.map((d) => <option key={d.$id} value={d.$id}>{d.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Role">
              <Select value={form.role || 'lecturer'} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Kuota Mahasiswa"><Input type="number" value={form.quota ?? 10} onChange={(e) => setForm({ ...form, quota: Number(e.target.value) })} /></Field>
            <Field label="Status">
              <Select value={form.is_active === false ? 'false' : 'true'} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}>
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </Select>
            </Field>
          </div>
          <Field label="Keahlian"><Input value={form.expertise || ''} onChange={(e) => setForm({ ...form, expertise: e.target.value })} placeholder="Contoh: Sistem Informasi, Hukum" /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModal(null)}>Batal</Button>
            <Button onClick={save} loading={busy}>Simpan</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
