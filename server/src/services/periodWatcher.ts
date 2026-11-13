import { db } from '../database';
import {
  getPeriodStatus,
  notifyPeriodStatusChange,
  type PeriodStatus,
} from './notificationService';

/**
 * Watcher status masa pengajuan.
 *
 * Polling tiap INTERVAL_MS: hitung status periode dari system_settings,
 * dan broadcast push notification ke semua user saat status BERUBAH
 * (open / upcoming / closed) — baik karena admin mengubah settings
 * maupun karena batas tanggal terlewati otomatis.
 *
 * Status awal dicatat diam-diam saat startup (tidak spam notifikasi
 * untuk state yang memang sudah berjalan sebelum server nyala).
 */

const INTERVAL_MS = 60 * 1000;

let lastStatus: PeriodStatus | null = null;
let timer: NodeJS.Timeout | null = null;

async function checkPeriodStatus() {
  try {
    const settings = await db.getSystemSettings();
    const status = getPeriodStatus(settings);

    if (lastStatus === null) {
      lastStatus = status;
      console.log(`[period-watch] Status awal: ${status}`);
      return;
    }

    if (status !== lastStatus) {
      console.log(`[period-watch] Status berubah: ${lastStatus} → ${status}`);
      lastStatus = status;
      void notifyPeriodStatusChange(status);
    }
  } catch (e) {
    console.warn('[period-watch] Gagal cek status periode:', e);
  }
}

export function startPeriodWatcher() {
  if (timer) return;
  // Cek segera saat start untuk baseline, lalu interval
  void checkPeriodStatus();
  timer = setInterval(checkPeriodStatus, INTERVAL_MS);
  timer.unref?.();
  console.log(`[period-watch] Watcher aktif (interval ${INTERVAL_MS / 1000}s)`);
}
