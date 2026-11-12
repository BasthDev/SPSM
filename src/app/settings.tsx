import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { AppHeader, Section } from '@/components';
import {
  getNotificationPermission,
  getStoredPushToken,
  isNotificationsEnabled,
  sendTestNotification,
  setNotificationsEnabled,
  setupNotificationHandler,
  type NotificationPermission,
} from '@/services/notificationService';
import { Colors } from '@/theme/theme';
import { Bell, ChevronRight, Info, Send } from 'lucide-react-native';

export default function SettingsScreen() {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('undetermined');
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [on, perm, token] = await Promise.all([
      isNotificationsEnabled(),
      getNotificationPermission(),
      getStoredPushToken(),
    ]);
    setEnabled(on);
    setPermission(perm);
    setPushToken(token);
  }, []);

  useEffect(() => {
    setupNotificationHandler();
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);

  // Refresh saat kembali ke halaman (mis. setelah buka pengaturan sistem)
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleToggle = async (value: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await setNotificationsEnabled(value);
      await refresh();
      if (!result.ok && result.reason === 'denied') {
        Alert.alert(
          'Izin Ditolak',
          'Izin notifikasi ditolak. Aktifkan manual lewat Pengaturan aplikasi di perangkat Anda.',
          [
            { text: 'Nanti Saja', style: 'cancel' },
            { text: 'Buka Pengaturan', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const permissionLabel =
    permission === 'granted'
      ? 'Diizinkan'
      : permission === 'denied'
        ? 'Ditolak sistem'
        : 'Belum diminta';

  return (
    <View style={styles.flex}>
      <AppHeader title="Pengaturan" showBack backHref="/profile" />

      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
        {/* Notifikasi */}
        <Section style={styles.section}>
          <Text style={styles.sectionHeading}>Notifikasi</Text>
          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Bell size={17} color={Colors.primary} strokeWidth={2.2} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowLabel}>Notifikasi Push</Text>
              <Text style={styles.rowSub}>Izin sistem: {permissionLabel}</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              disabled={busy}
              trackColor={{ false: '#E2E8F0', true: Colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {permission === 'denied' ? (
            <TouchableOpacity
              style={styles.settingsLink}
              onPress={() => Linking.openSettings()}
              activeOpacity={0.7}
            >
              <Text style={styles.settingsLinkText}>Buka Pengaturan Perangkat</Text>
              <ChevronRight size={16} color={Colors.primary} strokeWidth={2.4} />
            </TouchableOpacity>
          ) : null}

          {enabled ? (
            <TouchableOpacity
              style={styles.testButton}
              onPress={async () => {
                await sendTestNotification();
              }}
              activeOpacity={0.75}
            >
              <Send size={15} color={Colors.primary} strokeWidth={2.2} />
              <Text style={styles.testButtonText}>Kirim Notifikasi Uji</Text>
            </TouchableOpacity>
          ) : null}

          {pushToken ? (
            <Text style={styles.tokenText} numberOfLines={1}>
              Device token: {pushToken.slice(0, 24)}…
            </Text>
          ) : null}
        </Section>

        {/* Tentang */}
        <Section style={styles.section}>
          <Text style={styles.sectionHeading}>Tentang Aplikasi</Text>
          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Info size={17} color={Colors.primary} strokeWidth={2.2} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowLabel}>Sistem Penerimaan Skripsi</Text>
              <Text style={styles.rowSub}>
                v{Constants.expoConfig?.version ?? '1.0.0'} — Universitas Muhammadiyah Aceh
              </Text>
            </View>
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextCol: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.text,
  },
  rowSub: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 8,
    gap: 2,
  },
  settingsLinkText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primary,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: '#E0F2FE',
  },
  testButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  tokenText: {
    fontSize: 10.5,
    color: Colors.textTertiary,
    marginTop: 10,
    fontFamily: 'monospace' as any,
  },
});
