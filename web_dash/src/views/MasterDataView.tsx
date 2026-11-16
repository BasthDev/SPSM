import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Plus, Pencil, Trash2, Building2, CalendarDays } from 'lucide-react';
import { masterDataService } from '@/services/masterDataService';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Spinner } from '@/components/ui';
import type { Department, BatchYear } from '@/types';

export function MasterDataView() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'dept' | 'year'>('dept');
  const [modal, setModal] = useState<'dept-create' | Department | 'year-create' | BatchYear | null>(null);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: departments = [], isLoading: ld } = useQuery({ queryKey: ['departments'], queryFn: () => masterDataService.getDepartments() });
  const { data: batchYears = [], isLoading: ly } = useQuery({ queryKey: ['batchYears'], queryFn: () => masterDataService.getBatchYears() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['departments'] });
    qc.invalidateQueries({ queryKey: ['batchYears'] });
  };

  const openDeptCreate = () => { setForm({ code: '', name: '', faculty: '', is_active: true }); setErr(null); setModal('dept-create'); };
  const openDeptEdit = (d: Department) => { setForm({ ...d }); setErr(null); setModal(d); };
  const openYearCreate = () => { setForm({ year: '', label: '', is_active: true }); setErr(null); setModal('year-create'); };
  const openYearEdit = (b: BatchYear) => { setForm({ ...b }); setErr(null); setModal(b); };

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      if (modal === 'dept-create') await masterDataService.createDepartment(form);
      else if (modal === 'year-create') await masterDataService.createBatchYear(form);
      else if (modal && typeof modal === 'object' && 'code' in modal) await masterDataService.updateDepartment(modal.$id, form);
      else if (modal && typeof modal === 'object') await masterDataService.updateBatchYear((modal as BatchYear).$id, form);
      invalidate();
      setModal(null);
    } catch (e: any) {
      setErr(e.message || 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  const isDeptModal = modal === 'dept-create' || (modal && typeof modal === 'object' && 'code' in modal);
  const isYearModal = modal === 'year-create' || (modal && typeof modal === 'object' && 'year' in modal);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink-900">Master Data</h1>
          <p className="mt-0.5 text-[13px] text-ink-500">Program Studi & Tahun Angkatan</p>
        </div>
        <Button onClick={tab === 'dept' ? openDeptCreate : openYearCreate}>
          <Plus size={15} /> {tab === 'dept' ? 'Tambah Prodi' : 'Tambah Angkatan'}
        </Button>
      </div>

      <div className="flex gap-1.5">
        {([['dept', 'Program Studi', <Building2 key="i" size={14} />], ['year', 'Tahun Angkatan', <CalendarDays key="i" size={14} />]] as const).map(([v, label, icon]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-bold transition-colors ${
              tab === v ? 'bg-brand-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === 'dept' ? (
        <Card className="overflow-hidden">
          {ld ? <div className="flex justify-center py-16"><Spinner /></div> : departments.length === 0 ? (
            <EmptyState icon={<Database size={36} />} title="Belum ada program studi" />
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-[11px] font-extrabold uppercase tracking-wider text-ink-400">
                  <th className="px-5 py-3">Kode</th>
                  <th className="px-4 py-3">Nama Program Studi</th>
                  <th className="px-4 py-3">Fakultas</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {departments.map((d) => (
                  <tr key={d.$id} className="hover:bg-ink-50/60">
                    <td className="px-5 py-3.5 font-mono text-[12px] font-bold text-brand-800">{d.code}</td>
                    <td className="px-4 py-3.5 font-bold text-ink-900">{d.name}</td>
                    <td className="px-4 py-3.5 text-ink-600">{d.faculty || '-'}</td>
                    <td className="px-4 py-3.5"><Badge tone={d.is_active ? 'green' : 'red'}>{d.is_active ? 'Aktif' : 'Nonaktif'}</Badge></td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => openDeptEdit(d)} className="rounded-lg p-2 text-ink-400 hover:bg-brand-50 hover:text-brand-700"><Pencil size={15} /></button>
                        <button onClick={async () => { if (confirm('Hapus prodi ini?')) { await masterDataService.deleteDepartment(d.$id); invalidate(); } }} className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {ly ? <div className="flex justify-center py-16"><Spinner /></div> : batchYears.length === 0 ? (
            <EmptyState icon={<Database size={36} />} title="Belum ada data angkatan" />
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-[11px] font-extrabold uppercase tracking-wider text-ink-400">
                  <th className="px-5 py-3">Tahun</th>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {batchYears.map((b) => (
                  <tr key={b.$id} className="hover:bg-ink-50/60">
                    <td className="px-5 py-3.5 font-bold text-ink-900">{b.year}</td>
                    <td className="px-4 py-3.5 text-ink-600">{b.label || `Angkatan ${b.year}`}</td>
                    <td className="px-4 py-3.5"><Badge tone={b.is_active ? 'green' : 'red'}>{b.is_active ? 'Aktif' : 'Nonaktif'}</Badge></td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => openYearEdit(b)} className="rounded-lg p-2 text-ink-400 hover:bg-brand-50 hover:text-brand-700"><Pencil size={15} /></button>
                        <button onClick={async () => { if (confirm('Hapus angkatan ini?')) { await masterDataService.deleteBatchYear(b.$id); invalidate(); } }} className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <Modal open={modal !== null} onClose={() => setModal(null)} title={isDeptModal ? 'Program Studi' : 'Tahun Angkatan'}>
        <div className="space-y-4">
          {err && <div className="rounded-lg bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-600">{err}</div>}
          {isDeptModal ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kode Prodi"><Input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="BD" /></Field>
                <Field label="Fakultas"><Input value={form.faculty || ''} onChange={(e) => setForm({ ...form, faculty: e.target.value })} /></Field>
              </div>
              <Field label="Nama Program Studi"><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bisnis Digital" /></Field>
              <Field label="Status">
                <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-700">
                  <input type="checkbox" checked={form.is_active !== false} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 accent-brand-700" />
                  Aktif
                </label>
              </Field>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tahun"><Input type="number" value={form.year ?? ''} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} placeholder="2023" /></Field>
                <Field label="Label"><Input value={form.label || ''} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Angkatan 2023" /></Field>
              </div>
              <Field label="Status">
                <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-700">
                  <input type="checkbox" checked={form.is_active !== false} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 accent-brand-700" />
                  Aktif
                </label>
              </Field>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModal(null)}>Batal</Button>
            <Button onClick={save} loading={busy}>Simpan</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
