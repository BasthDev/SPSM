import { AppHeader, Avatar, Button, Dropdown, Input, LoadingScreen, Section } from '@/components';
import { FALLBACK_BATCH_YEARS, FALLBACK_DEPARTMENTS } from '@/models/types';
import { academicService } from '@/services/academicService';
import { apiClient } from '@/services/apiClient';
import { authService } from '@/services/authService';
import { userDataCache } from '@/services/userDataCache';
import { Colors } from '@/theme/theme';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
  const [avatarBusy, setAvatarBusy] = useState(false);

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

  /** Pilih foto dari galeri → upload file ke server (file field users.avatar). */
  const handlePickAvatar = async () => {
    if (avatarBusy || !userId) return;
    setAvatarBusy(true);
    try {
      console.log('[avatar] meminta izin galeri...');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        console.warn('[avatar] izin galeri ditolak');
        Alert.alert('Izin Diperlukan', 'Izinkan akses galeri untuk mengganti foto profil.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) {
        console.log('[avatar] pemilihan dibatalkan user');
        return;
      }
      const asset = result.assets[0];
      console.log('[avatar] foto dipilih:', asset.uri, asset.mimeType, asset.fileName);

      console.log('[avatar] upload ke server...');
      const updated = await apiClient.users.uploadAvatar(userId, {
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      });
      const newUrl = updated?.avatarUrl || updated?.avatar_url || '';
      console.log('[avatar] upload berhasil, avatar_url:', newUrl ? 'tersimpan' : '(kosong)');
      setAvatarUrl(newUrl);
      userDataCache.clear(userId).catch(() => {});
      Alert.alert('Berhasil', 'Foto profil berhasil diunggah.');
    } catch (e: any) {
      console.error('[avatar] upload GAGAL:', e?.message || e);
      Alert.alert('Upload Gagal', e?.message || 'Foto profil gagal diunggah. Coba lagi.');
    } finally {
      setAvatarBusy(false);
    }
  };

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

          {/* Avatar — tap untuk upload foto, disimpan base64 di avatar_url */}
          <View style={styles.avatarRow}>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8} disabled={avatarBusy}>
              <View>
                <Avatar
                  name={name || 'Mahasiswa'}
                  source={avatarUrl || null}
                  size={72}
                  backgroundColor={Colors.primary}
                  iconFallback
                />
                <View style={styles.avatarCameraBadge}>
                  <Camera size={14} color="#FFFFFF" strokeWidth={2.4} />
                </View>
              </View>
            </TouchableOpacity>
            <View style={styles.avatarTextCol}>
              <Text style={styles.avatarLabel}>Foto Profil</Text>
              <Text style={styles.avatarHint}>
                Ketuk foto untuk mengganti dari galeri. Foto otomatis dikompres & disimpan aman.
              </Text>
              {avatarUrl ? (
                <TouchableOpacity onPress={() => setAvatarUrl('')} activeOpacity={0.7}>
                  <Text style={styles.avatarRemove}>Hapus foto</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
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
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.borderLight ?? '#F1F5F9',
  },
  avatarTextCol: {
    flex: 1,
  },
  avatarLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  avatarHint: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 3,
    lineHeight: 17,
  },
  avatarRemove: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 6,
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  buttonWrapper: {
    marginTop: 8,
  },
});
