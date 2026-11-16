import fs from 'fs';
import jwt from 'jsonwebtoken';
import { config } from '../config';

/**
 * Firebase Cloud Messaging HTTP v1 sender.
 *
 * Butuh service account JSON dari Firebase Console
 * (Project Settings > Service accounts > Generate new private key).
 * Sumber kredensial (pilih salah satu):
 *  - FCM_SERVICE_ACCOUNT_JSON  : isi JSON mentah
 *  - FCM_SERVICE_ACCOUNT_PATH  : path ke file .json (atau GOOGLE_APPLICATION_CREDENTIALS)
 */

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let cachedAccount: ServiceAccount | null = null;
let cachedToken: { value: string; expiresAt: number } | null = null;

function loadServiceAccount(): ServiceAccount | null {
  if (cachedAccount) return cachedAccount;

  let raw = '';
  if (config.fcm.serviceAccountJson) {
    raw = config.fcm.serviceAccountJson;
  } else if (config.fcm.serviceAccountPath) {
    try {
      raw = fs.readFileSync(config.fcm.serviceAccountPath, 'utf8');
    } catch (e) {
      console.warn('[fcm] Gagal membaca service account file:', e);
      return null;
    }
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
      console.warn('[fcm] Service account JSON tidak lengkap (butuh project_id, client_email, private_key).');
      return null;
    }
    cachedAccount = parsed as ServiceAccount;
    return cachedAccount;
  } catch (e) {
    console.warn('[fcm] Service account JSON tidak valid:', e);
    return null;
  }
}

export function isFcmConfigured(): boolean {
  return loadServiceAccount() !== null;
}

async function getAccessToken(): Promise<string | null> {
  const sa = loadServiceAccount();
  if (!sa) return null;

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.value;
  }

  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
    { algorithm: 'RS256' }
  );

  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });

  if (!res.ok) {
    console.warn('[fcm] Gagal mengambil OAuth token:', res.status, await res.text().catch(() => ''));
    return null;
  }

  const data: any = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: now + (data.expires_in || 3600),
  };
  return cachedToken.value;
}

export interface FcmMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Path ke icon small notification (opsional, Android) */
  icon?: string;
  color?: string;
}

/** Kirim notifikasi ke satu FCM device token. */
export async function sendFcmNotification(msg: FcmMessage): Promise<{ ok: boolean; error?: string }> {
  const sa = loadServiceAccount();
  if (!sa) {
    return { ok: false, error: 'FCM service account belum dikonfigurasi (FCM_SERVICE_ACCOUNT_JSON/PATH).' };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { ok: false, error: 'Gagal mendapatkan FCM access token.' };
  }

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token: msg.token,
          notification: { title: msg.title, body: msg.body },
          data: msg.data || {},
          android: {
            priority: 'HIGH',
            notification: {
              // Harus sama dengan channel_id yang dibuat di mobile
              // (notificationService.ts -> DEFAULT_CHANNEL = 'default').
              // Android 8+ mengatur sound/vibration per channel — tanpanya
              // notifikasi jatuh ke channel sistem yang bisa silent.
              channel_id: 'default',
              sound: 'default',
              ...(msg.color ? { color: msg.color } : {}),
            },
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, error: `FCM send gagal (${res.status}): ${errText.slice(0, 300)}` };
  }
  return { ok: true };
}
