import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
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
  getStoredDeviceToken,
  isNotificationsEnabled,
  sendTestNotification,
  setNotificationsEnabled,
  setupNotificationHandler,
  syncPushRegistrationIfEnabled,
  type NotificationPermission,
} from '@/services/notificationService';
import { Colors } from '@/theme/theme';
import {
  Bell,
  BellRing,
  ChevronRight,
  Heart,
  Info,
  Send,
  ShieldCheck,
} from 'lucide-react-native';

export default function SettingsScreen() {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('undetermined');
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [on, perm, token] = await Promise.all([
      isNotificationsEnabled(),
      getNotificationPermission(),
      getStoredDeviceToken(),
    ]);
    setEnabled(on);
    setPermission(perm);
    setPushToken(token);
  }, []);

  useEffect(() => {
    setupNotificationHandler();
    void syncPushRegistrationIfEnabled();
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

  const permissionMeta =
    permission === 'granted'
      ? { label: 'Diizinkan', bg: '#ECFDF5', fg: '#059669' }
      : permission === 'denied'
        ? { label: 'Ditolak sistem', bg: '#FEF2F2', fg: '#DC2626' }
        : { label: 'Belum diminta', bg: '#F1F5F9', fg: '#64748B' };

  return (
    <View style={styles.flex}>
      <AppHeader title="Pengaturan" showBack backHref="/profile" />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Notifikasi ─────────────────────────────── */}
        <Section style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.headerIcon, { backgroundColor: '#E0F2FE' }]}>
              <BellRing size={18} color={Colors.primary} strokeWidth={2.2} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Notifikasi</Text>
              <Text style={styles.cardSubtitle}>Push notification & izin perangkat</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Toggle row */}
          <View style={styles.toggleRow}>
            <View style={[styles.iconBubble, enabled ? styles.iconBubbleActive : null]}>
              <Bell size={17} color={enabled ? Colors.primary : Colors.textTertiary} strokeWidth={2.2} />
            </View>
            <View style={styles.toggleTextCol}>
              <Text style={styles.rowLabel}>Notifikasi Push</Text>
              <Text style={styles.rowSub}>
                {enabled ? 'Aktif — kamu akan menerima kabar terbaru' : 'Nonaktif — tidak ada notifikasi masuk'}
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              disabled={busy}
              trackColor={{ false: '#E2E8F0', true: Colors.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E2E8F0"
            />
          </View>

          {/* Status izin chip */}
          <View style={styles.statusRow}>
            <ShieldCheck size={13} color={permissionMeta.fg} strokeWidth={2.4} />
            <Text style={[styles.statusText, { color: permissionMeta.fg }]}>
              Izin sistem: {permissionMeta.label}
            </Text>
            <View style={[styles.statusChip, { backgroundColor: permissionMeta.bg }]}>
              <Text style={[styles.statusChipText, { color: permissionMeta.fg }]}>
                {Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : 'Web'}
              </Text>
            </View>
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
              <Send size={15} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.testButtonText}>Kirim Notifikasi Uji</Text>
            </TouchableOpacity>
          ) : null}

          {enabled && pushToken ? (
            <View style={styles.tokenBox}>
              <Text style={styles.tokenLabel}>FCM DEVICE TOKEN</Text>
              <Text style={styles.tokenText} numberOfLines={1}>
                {pushToken}
              </Text>
            </View>
          ) : null}
        </Section>

        {/* ── Tentang ────────────────────────────────── */}
        <Section style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.headerIcon, { backgroundColor: '#F5F3FF' }]}>
              <Info size={18} color="#7C3AED" strokeWidth={2.2} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Tentang Aplikasi</Text>
              <Text style={styles.cardSubtitle}>Informasi sistem & versi</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Aplikasi</Text>
              <Text style={styles.infoValue}>Sistem Penerimaan Skripsi</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Versi</Text>
              <Text style={styles.infoValue}>v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Institusi</Text>
              <Text style={styles.infoValue}>Univ. Muhammadiyah Aceh</Text>
            </View>
          </View>
        </Section>

        {/* ── Footer ─────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Build with</Text>
          <Heart size={13} color="#F43F5E" fill="#F43F5E" strokeWidth={0} />
          <Text style={styles.footerText}>by BasthDev</Text>
        </View>
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
    paddingBottom: 48,
  },
  card: {
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    backgroundColor: Colors.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight ?? '#F1F5F9',
    marginVertical: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleActive: {
    backgroundColor: '#E0F2FE',
  },
  toggleTextCol: {
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight ?? '#F1F5F9',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 10,
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
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  testButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tokenBox: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight ?? '#F1F5F9',
    padding: 10,
  },
  tokenLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  tokenText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12.5,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13.5,
    color: Colors.text,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
});
