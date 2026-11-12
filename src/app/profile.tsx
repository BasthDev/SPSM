import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AppHeader,
  Section,
  Avatar,
  Button,
  LoadingScreen,
} from '@/components';
import { authService } from '@/services/authService';
import { academicService } from '@/services/academicService';
import type { UserProfile } from '@/models/types';
import { Colors } from '@/theme/theme';
import { BookOpen, Hash, Calendar, Shield, LogOut, Phone } from 'lucide-react-native';

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [deptName, setDeptName] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const acct = await authService.getCurrentAccount();
        const [profile, depts] = await Promise.all([
          authService.getUserProfile(acct.$id),
          academicService.getDepartments().catch(() => []),
        ]);
        if (!active) return;
        setUser(profile);
        const code = (profile?.department || '').trim();
        const found = depts.find(
          (d) =>
            d.code.toLowerCase() === code.toLowerCase() ||
            d.name.toLowerCase() === code.toLowerCase()
        );
        setDeptName(found ? found.name : code || '');
      } catch {
        if (active) {
          router.replace('/login');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [router]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Apakah Anda yakin ingin keluar dari akun ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          await authService.logout();
          router.replace('/login');
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen message="Memuat profil..." />;

  const deptLabel = deptName || user?.department || '-';

  return (
    <View style={styles.flex}>
      <AppHeader title="Profil Saya" showBack backHref="/dashboard" />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Card Hero */}
        <View style={styles.heroCard}>
          <View style={styles.avatarWrapper}>
            <Avatar
              name={user?.name}
              source={user?.avatar_url}
              size={76}
              backgroundColor={Colors.primary}
            />
          </View>
          <Text style={styles.name}>{user?.name ?? 'Mahasiswa'}</Text>
          <Text style={styles.email}>{user?.email ?? '-'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>MAHASISWA AKTIF</Text>
          </View>
        </View>

        {/* Academic Details Section */}
        <Section style={styles.detailsSection}>
          <Text style={styles.sectionHeading}>Data Akademik</Text>

          <View style={styles.divider} />

          <InfoRow
            icon={<Hash size={16} color={Colors.primary} strokeWidth={2.2} />}
            label="Nomor Induk Mahasiswa (NIM)"
            value={user?.nim_or_nip ?? '-'}
          />

          <InfoRow
            icon={<BookOpen size={16} color={Colors.primary} strokeWidth={2.2} />}
            label="Program Studi"
            value={deptLabel}
          />

          {user?.phone ? (
            <InfoRow
              icon={<Phone size={16} color={Colors.primary} strokeWidth={2.2} />}
              label="WhatsApp / Telepon"
              value={user.phone}
            />
          ) : null}

          <InfoRow
            icon={<Calendar size={16} color={Colors.primary} strokeWidth={2.2} />}
            label="Tahun Angkatan"
            value={String(user?.batch_year ?? '-')}
          />

          <InfoRow
            icon={<Shield size={16} color={Colors.primary} strokeWidth={2.2} />}
            label="Status Akun"
            value="Terverifikasi SSO Google"
          />
        </Section>

        {/* Actions */}
        <View style={styles.actionsWrapper}>
          <Button
            title="Keluar dari Akun"
            onPress={handleSignOut}
            variant="danger"
            icon={<LogOut size={16} color="#ffffff" strokeWidth={2.2} />}
            style={styles.signOutButton}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={infoStyles.row}>
      <View style={infoStyles.iconCircle}>{icon}</View>
      <View style={infoStyles.textCol}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={infoStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  label: {
    fontSize: 11.5,
    color: Colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 14.5,
    color: Colors.text,
    fontWeight: '700',
    marginTop: 1,
  },
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 16,
  },
  avatarWrapper: {
    borderWidth: 3,
    borderColor: '#E0F2FE',
    borderRadius: 45,
    padding: 2,
    marginBottom: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  email: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    marginTop: 10,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  detailsSection: {
    marginBottom: 20,
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
  actionsWrapper: {
    marginTop: 4,
  },
  signOutButton: {
    marginTop: 4,
  },
});
