import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from './apiClient';

const ENABLED_KEY = 'spsm_notifications_enabled';
const DEVICE_TOKEN_KEY = 'spsm_fcm_device_token';
const DEFAULT_CHANNEL = 'default';

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

let handlerConfigured = false;

/** Pasang handler notifikasi global — tampilkan banner + suara saat app di foreground. */
export function setupNotificationHandler() {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Buat notification channel Android (wajib untuk Android 8+). */
export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL, {
    name: 'Notifikasi SPSM',
    // eslint-disable-next-line import/namespace -- enum via re-export expo-notifications
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0A4C8F',
  });
}

export async function isNotificationsEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(ENABLED_KEY);
  return v === 'true';
}

export async function getStoredDeviceToken(): Promise<string | null> {
  return AsyncStorage.getItem(DEVICE_TOKEN_KEY);
}

/** Ambil status izin notifikasi native saat ini. */
export async function getNotificationPermission(): Promise<NotificationPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

/**
 * Ambil FCM device token native (Android) — dikirim ke backend yang mendaftarkannya
 * sebagai Appwrite push target (provider FCM di Messaging).
 * iOS butuh provider APNs di Appwrite; web tidak support.
 */
async function getFcmDeviceToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[notifications] Bukan physical device — FCM token tidak tersedia.');
    return null;
  }
  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = typeof tokenData.data === 'string' ? tokenData.data : String(tokenData.data);
    await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);
    return token;
  } catch (e) {
    console.warn('[notifications] Gagal mengambil FCM device token:', e);
    return null;
  }
}

export type ToggleResult =
  | { ok: true; permission: NotificationPermission }
  | { ok: false; reason: 'denied' | 'error'; permission: NotificationPermission };

/**
 * Toggle notifikasi:
 * - ON  → minta izin native (POST_NOTIFICATIONS Android 13+), ambil FCM token,
 *         daftarkan ke backend → Appwrite push target.
 * - OFF → hapus target di server + matikan flag in-app.
 *         Izin OS tidak bisa dicabut via API — arahkan user ke Settings bila perlu.
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<ToggleResult> {
  await ensureAndroidChannel();

  if (!enabled) {
    await AsyncStorage.setItem(ENABLED_KEY, 'false');
    try {
      await apiClient.notifications.unregister();
    } catch (e) {
      console.warn('[notifications] unregister gagal:', e);
    }
    const { status } = await Notifications.getPermissionsAsync();
    return {
      ok: true,
      permission: status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined',
    };
  }

  const { status } = await Notifications.requestPermissionsAsync();
  const permission: NotificationPermission =
    status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';

  if (permission === 'granted') {
    const token = await getFcmDeviceToken();
    if (token) {
      try {
        await apiClient.notifications.register(token);
      } catch (e) {
        console.warn('[notifications] register ke server gagal:', e);
      }
    }
    await AsyncStorage.setItem(ENABLED_KEY, 'true');
    return { ok: true, permission };
  }

  await AsyncStorage.setItem(ENABLED_KEY, 'false');
  return { ok: false, reason: 'denied', permission };
}

/**
 * Panggil saat app start / setelah login jika notifikasi aktif —
 * segarkan registrasi token (token FCM bisa berubah antar install).
 */
export async function syncPushRegistrationIfEnabled() {
  try {
    if (!(await isNotificationsEnabled())) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const token = await getFcmDeviceToken();
    if (token) {
      await apiClient.notifications.register(token);
    }
  } catch (e) {
    console.warn('[notifications] sync registrasi gagal:', e);
  }
}

/**
 * Minta izin notifikasi saat app start (hanya jika belum pernah ditanya).
 * Kalau diizinkan → aktifkan flag + register token (gagal diam-diam jika
 * belum login — akan di-sync ulang oleh syncPushRegistrationIfEnabled).
 */
export async function promptNotificationPermissionOnStart() {
  try {
    await ensureAndroidChannel();
    const perm = await getNotificationPermission();
    if (perm === 'undetermined') {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        await AsyncStorage.setItem(ENABLED_KEY, 'true');
        const token = await getFcmDeviceToken();
        if (token) {
          try {
            await apiClient.notifications.register(token);
          } catch {
            // Belum login — abaikan, sync nanti setelah auth
          }
        }
      } else {
        await AsyncStorage.setItem(ENABLED_KEY, 'false');
      }
      return;
    }
    // Sudah pernah dijawab — cukup sync ulang kalau aktif
    await syncPushRegistrationIfEnabled();
  } catch (e) {
    console.warn('[notifications] prompt on start gagal:', e);
  }
}

/** Kirim notifikasi lokal untuk testing (debug). */
export async function sendTestNotification() {
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'SPSM KU',
      body: 'Notifikasi uji — pengaturan notifikasi berfungsi!',
      sound: 'default',
    },
    trigger: null,
  });
}
