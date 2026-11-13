import { AppHeader, Button, Dropdown, Input, LoadingScreen, Section } from '@/components';
import { FALLBACK_BATCH_YEARS, FALLBACK_DEPARTMENTS } from '@/models/types';
import { academicService } from '@/services/academicService';
import { authService } from '@/services/authService';
import { userDataCache } from '@/services/userDataCache';
import { Colors } from '@/theme/theme';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function ProfileEditScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState('');

  const [name, setName] = useState('');
  const [nim, setNim] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [batchYear, setBatchYear] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const [departmentOptions, setDepartmentOptions] = useState(FALLBACK_DEPARTMENTS);
  const [batchYearOptions, setBatchYearOptions] = useState(FALLBACK_BATCH_YEARS);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const acct = await authService.getCurrentAccount();
        const [profile, depts, years] = await Promise.all([
          authService.getUserProfile(acct.$id),
          academicService.getDepartments().catch(() => []),
          academicService.getBatchYears().catch(() => []),
        ]);
        if (!active) return;
        if (!profile) {
          router.replace('/onboarding');
          return;
        }
        setUserId(acct.$id);
        setName(profile.name || '');
        setNim(profile.nim_or_nip || profile.nim || '');
        setPhone(profile.phone || '');
        setDepartment(profile.department || '');
        setBatchYear(profile.batch_year ? String(profile.batch_year) : '');
        setAvatarUrl(profile.avatar_url || '');

        if (depts.length > 0) {
          setDepartmentOptions(depts.map((d) => ({ label: d.name, value: d.code })));
        }
        if (years.length > 0) {
          setBatchYearOptions(
            years.map((y) => ({ label: y.label ?? `Angkatan ${y.year}`, value: String(y.year) }))
          );
        }
      } catch {
        if (active) router.replace('/login');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [router]);

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Nama lengkap wajib diisi';
    if (!nim.trim()) newErrors.nim = 'NIM wajib diisi';
    if (!department) newErrors.department = 'Program Studi wajib dipilih';
    if (!batchYear) newErrors.batchYear = 'Tahun angkatan wajib dipilih';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);
    try {
      await authService.updateProfile(userId, {
        name: name.trim(),
        nim: nim.trim(),
        department,
        batchYear,
        phone: phone.trim() || undefined,
        avatarUrl: avatarUrl.trim() || null,
      });
      // Refresh cache dashboard agar data baru langsung terpakai
      void userDataCache.clear(userId);
      Alert.alert('Berhasil', 'Profil berhasil diperbarui.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal memperbarui profil.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen message="Memuat profil..." />;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title="Edit Profil" showBack />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Section>
          <Text style={styles.sectionTitle}>Data Pribadi</Text>

          <Input
            label="Nama Lengkap"
            value={name}
            onChangeText={setName}
            placeholder="Masukkan nama lengkap"
            error={errors.name}
          />

          <Input
            label="NIM (Nomor Induk Mahasiswa)"
            value={nim}
            onChangeText={setNim}
            placeholder="Contoh: 20220140001"
            error={errors.nim}
          />

          <Input
            label="Nomor WhatsApp / Telepon"
            value={phone}
            onChangeText={setPhone}
            placeholder="Contoh: 081234567890"
            keyboardType="phone-pad"
          />

          <Input
            label="URL Foto Profil (opsional)"
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            placeholder="https://..."
            autoCapitalize="none"
            keyboardType="url"
          />
        </Section>

        <Section>
          <Text style={styles.sectionTitle}>Data Akademik</Text>

          <Dropdown
            label="Program Studi (Departemen)"
            value={department}
            options={departmentOptions}
            onValueChange={setDepartment}
            error={errors.department}
            placeholder="Pilih program studi Anda..."
          />

          <Dropdown
            label="Tahun Angkatan / Letting"
            value={batchYear}
            options={batchYearOptions}
            onValueChange={setBatchYear}
            error={errors.batchYear}
            placeholder="Pilih tahun letting..."
          />
        </Section>

        <View style={styles.buttonWrapper}>
          <Button
            title="Simpan Perubahan"
            onPress={handleSave}
            loading={saving}
            variant="primary"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.2,
    marginBottom: 14,
  },
  buttonWrapper: {
    marginTop: 8,
  },
});
