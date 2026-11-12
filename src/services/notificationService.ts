import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const ENABLED_KEY = 'spsm_notifications_enabled';
const TOKEN_KEY = 'spsm_push_token';
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
    // eslint-disable-next-line import/namespace -- enum tersedia via re-export expo-notifications
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0A4C8F',
  });
}

export async function isNotificationsEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(ENABLED_KEY);
  return v === 'true';
}

export async function getStoredPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

/** Ambil status izin notifikasi native saat ini. */
export async function getNotificationPermission(): Promise<NotificationPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

async function registerPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    // Expo Go / emulator tidak bisa menerima push token fisik
    console.warn('[notifications] Bukan physical device — push token tidak tersedia.');
    return null;
  }
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[notifications] EAS projectId belum diset — jalankan `eas init` untuk mendapatkan token.');
    return null;
  }
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    await AsyncStorage.setItem(TOKEN_KEY, tokenData.data);
    return tokenData.data;
  } catch (e) {
    console.warn('[notifications] Gagal mengambil Expo push token:', e);
    return null;
  }
}

export type ToggleResult =
  | { ok: true; permission: NotificationPermission }
  | { ok: false; reason: 'denied' | 'error'; permission: NotificationPermission };

/**
 * Toggle notifikasi:
 * - ON  → minta izin native (POST_NOTIFICATIONS di Android 13+), lalu daftar token push.
 * - OFF → matikan flag in-app. Izin OS tidak bisa dicabut via API — arahkan user ke
 *         pengaturan sistem bila perlu (lihat Linking.openSettings()).
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<ToggleResult> {
  await ensureAndroidChannel();

  if (!enabled) {
    await AsyncStorage.setItem(ENABLED_KEY, 'false');
    const { status } = await Notifications.getPermissionsAsync();
    return { ok: true, permission: status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined' };
  }

  const { status } = await Notifications.requestPermissionsAsync();
  const permission: NotificationPermission =
    status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';

  if (permission === 'granted') {
    await AsyncStorage.setItem(ENABLED_KEY, 'true');
    await registerPushToken();
    return { ok: true, permission };
  }

  await AsyncStorage.setItem(ENABLED_KEY, 'false');
  return { ok: false, reason: 'denied', permission };
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
