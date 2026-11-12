import { db } from '../database';
import { sendFcmNotification } from './fcmService';

/**
 * Push notification service — FCM HTTP v1 langsung (gratis, tanpa perantara).
 *
 * Alur:
 *  1. Device mendapat FCM token (native via expo-notifications)
 *     → mobile kirim ke POST /api/notifications/register
 *  2. Server menyimpan token di users.push_token (Appwrite DB)
 *  3. Server mengirim notifikasi via FCM HTTP v1 menggunakan service account
 *     Firebase (FCM_SERVICE_ACCOUNT_JSON / FCM_SERVICE_ACCOUNT_PATH).
 */

export async function registerPushTarget(
  appwriteUserId: string,
  fcmToken: string
): Promise<{ ok: boolean; error?: string }> {
  const profile = await db.getUserProfileByUserId(appwriteUserId).catch(() => null);
  if (!profile) {
    return { ok: false, error: 'Profil pengguna belum ada — selesaikan onboarding dulu.' };
  }
  await db.updateUserProfile(profile.id, { pushToken: fcmToken } as any);
  return { ok: true };
}

/** Hapus token perangkat (saat user mematikan notifikasi). */
export async function unregisterPushTarget(appwriteUserId: string): Promise<boolean> {
  const profile = await db.getUserProfileByUserId(appwriteUserId).catch(() => null);
  if (!profile) return false;
  await db.updateUserProfile(profile.id, { pushToken: null } as any);
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** Kirim push notification ke FCM token tersimpan milik seorang user. */
export async function sendPushToUser(
  appwriteUserId: string,
  payload: PushPayload
): Promise<{ ok: boolean; error?: string }> {
  const profile = await db.getUserProfileByUserId(appwriteUserId).catch(() => null);
  if (!profile?.pushToken) {
    return { ok: false, error: 'Tidak ada FCM token terdaftar untuk user ini.' };
  }
  return sendFcmNotification({
    token: profile.pushToken,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    color: '#0A4C8F',
  });
}

const STATUS_NOTIFICATIONS: Record<string, { title: string; body: (note?: string) => string }> = {
  pending_lecturer: {
    title: 'Pengajuan Diterima',
    body: () => 'Judul skripsi Anda sedang direview oleh Dosen Penilai.',
  },
  waiting_kaprodi: {
    title: 'Lolos Review Dosen',
    body: () => 'Proposal Anda disetujui Dosen Penilai dan diajukan ke Kaprodi.',
  },
  waiting_akademik: {
    title: 'Menunggu Verifikasi',
    body: () => 'Proposal Anda menunggu verifikasi administrasi akademik.',
  },
  sk_process: {
    title: 'SK Sedang Diproses',
    body: () => 'Surat Keputusan skripsi Anda sedang diproses administrasi.',
  },
  sk_issued: {
    title: 'SK Telah Terbit',
    body: () => 'Selamat! Surat Keputusan skripsi Anda sudah terbit. Buka aplikasi untuk detail.',
  },
  rejected: {
    title: 'Pengajuan Ditolak',
    body: (note) => `Pengajuan judul skripsi ditolak.${note ? ` Catatan: ${note}` : ''}`,
  },
  revision: {
    title: 'Perlu Revisi',
    body: (note) => `Proposal perlu revisi.${note ? ` Catatan: ${note}` : ''}`,
  },
};

/** Fire-and-forget: kirim notifikasi status submission ke mahasiswa. */
export async function notifySubmissionStatus(
  appwriteUserId: string | undefined | null,
  status: string,
  submissionId: string,
  notes?: string
): Promise<void> {
  if (!appwriteUserId) return;
  const tpl = STATUS_NOTIFICATIONS[status];
  if (!tpl) return;
  try {
    const res = await sendPushToUser(appwriteUserId, {
      title: tpl.title,
      body: tpl.body(notes),
      data: { type: 'submission_status', submissionId, status },
    });
    if (!res.ok) {
      console.warn('[push] send failed:', res.error);
    }
  } catch (e) {
    console.warn('[push] notifySubmissionStatus error:', e);
  }
}
