import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader, Section, Input, Dropdown, Button, Stepper, Avatar } from '@/components';
import { authService } from '@/services/authService';
import { academicService } from '@/services/academicService';
import {
  FALLBACK_DEPARTMENTS,
  FALLBACK_BATCH_YEARS,
} from '@/models/types';
import { Colors } from '@/theme/theme';
import { User, BookOpen, CheckCircle2 } from 'lucide-react-native';

const STEPS = ['Data Pribadi', 'Akademik', 'Konfirmasi'];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [accountData, setAccountData] = useState<{ $id: string; name: string; email: string } | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [nim, setNim] = useState('');
  const [department, setDepartment] = useState('');
  const [batchYear, setBatchYear] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  // Dynamic Options from DB
  const [departmentOptions, setDepartmentOptions] = useState(FALLBACK_DEPARTMENTS);
  const [batchYearOptions, setBatchYearOptions] = useState(FALLBACK_BATCH_YEARS);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    const loadAccountAndOptions = async () => {
      try {
        const acct = await authService.getCurrentAccount();
        if (!active) return;
        setAccountData(acct);
        setName(acct.name || '');
        setEmail(acct.email || '');

        // Generate Google / Appwrite avatar URL if available
        const defaultAvatar = `https://sgp.cloud.appwrite.io/v1/avatars/initials?name=${encodeURIComponent(
          acct.name || 'User'
        )}&project=6af1b3b200056ab6bc1d`;
        setAvatarUrl(defaultAvatar);

        // Fetch dynamic departments from Appwrite Database
        const depts = await academicService.getDepartments();
        if (active && depts.length > 0) {
          setDepartmentOptions(
            depts.map((d) => ({
              label: `${d.name} (${d.code})`,
              value: d.code,
            }))
          );
        }

        // Fetch dynamic batch years (letting) from Appwrite Database
        const years = await academicService.getBatchYears();
        if (active && years.length > 0) {
          setBatchYearOptions(
            years.map((y) => ({
              label: y.label,
              value: String(y.year),
            }))
          );
        }
      } catch {
        if (active) {
          router.replace('/login');
        }
      }
    };

    loadAccountAndOptions();

    return () => {
      active = false;
    };
  }, [router]);

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!name.trim()) newErrors.name = 'Nama lengkap wajib diisi';
      if (!email.trim()) newErrors.email = 'Email institusi wajib diisi';
    } else if (step === 1) {
      if (!nim.trim()) newErrors.nim = 'NIM wajib diisi';
      if (!department) newErrors.department = 'Program Studi wajib dipilih';
      if (!batchYear) newErrors.batchYear = 'Tahun angkatan (letting) wajib dipilih';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login');
    }
  };

  const handleSubmit = async () => {
    if (!accountData) return;

    setLoading(true);
    try {
      await authService.completeOnboarding(accountData.$id, {
        name: name.trim(),
        email: email.trim(),
        nim: nim.trim(),
        department,
        batchYear,
        whatsapp: whatsapp.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
      });
      router.replace('/dashboard');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal menyimpan data.');
    } finally {
      setLoading(false);
    }
  };

  const selectedDeptLabel =
    departmentOptions.find((d) => d.value === department)?.label ?? department;
  const selectedYearLabel =
    batchYearOptions.find((y) => y.value === batchYear)?.label ?? batchYear;

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <Section>
            <View style={styles.stepHeaderRow}>
              <View style={styles.stepIconCircle}>
                <User size={18} color={Colors.primary} strokeWidth={2.4} />
              </View>
              <Text style={styles.sectionTitle}>Identitas Mahasiswa</Text>
            </View>

            {/* Avatar Preview */}
            <View style={styles.avatarRow}>
              <Avatar name={name || 'User'} source={avatarUrl} size={64} />
              <View style={styles.avatarTextCol}>
                <Text style={styles.avatarName}>{name || 'Mahasiswa'}</Text>
                <Text style={styles.avatarEmail}>{email || 'Google Account'}</Text>
              </View>
            </View>

            <Input
              label="Nama Lengkap"
              value={name}
              onChangeText={setName}
              placeholder="Masukkan nama lengkap"
              error={errors.name}
            />

            <Input
              label="Email Institusi"
              value={email}
              onChangeText={setEmail}
              placeholder="nama@university.ac.id"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />

            <Input
              label="Nomor WhatsApp (opsional)"
              value={whatsapp}
              onChangeText={setWhatsapp}
              placeholder="08xxxxxxxxxx"
              keyboardType="phone-pad"
              hint="Digunakan untuk notifikasi plotting dosen pembimbing"
            />
          </Section>
        );

      case 1:
        return (
          <Section>
            <View style={styles.stepHeaderRow}>
              <View style={styles.stepIconCircle}>
                <BookOpen size={18} color={Colors.primary} strokeWidth={2.4} />
              </View>
              <Text style={styles.sectionTitle}>Data Akademik</Text>
            </View>

            <Input
              label="NIM (Nomor Induk Mahasiswa)"
              value={nim}
              onChangeText={setNim}
              placeholder="Contoh: 20220140001"
              error={errors.nim}
            />

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
        );

      case 2:
        return (
          <Section>
            <View style={styles.stepHeaderRow}>
              <View style={[styles.stepIconCircle, { backgroundColor: Colors.successLight }]}>
                <CheckCircle2 size={18} color={Colors.success} strokeWidth={2.4} />
              </View>
              <Text style={styles.sectionTitle}>Konfirmasi Profil</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Nama Lengkap</Text>
              <Text style={styles.summaryValue}>{name}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Email</Text>
              <Text style={styles.summaryValue}>{email}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>NIM</Text>
              <Text style={styles.summaryValue}>{nim}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Program Studi</Text>
              <Text style={styles.summaryValue}>{selectedDeptLabel}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Tahun Angkatan (Letting)</Text>
              <Text style={styles.summaryValue}>{selectedYearLabel}</Text>
            </View>
            {whatsapp ? (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>WhatsApp</Text>
                <Text style={styles.summaryValue}>{whatsapp}</Text>
              </View>
            ) : null}
          </Section>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader
        title="Registrasi Profil"
        showBack={currentStep > 0}
        onBack={handleBack}
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Stepper Header */}
        <Stepper steps={STEPS} currentStep={currentStep} style={styles.stepper} />

        {/* Step Content */}
        {renderStep()}

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          {currentStep > 0 && (
            <Button
              title="Kembali"
              onPress={handleBack}
              variant="secondary"
              style={styles.buttonHalf}
            />
          )}
          {currentStep < STEPS.length - 1 ? (
            <Button
              title="Lanjut"
              onPress={handleNext}
              variant="primary"
              style={[styles.buttonHalf, currentStep === 0 && styles.buttonFull]}
            />
          ) : (
            <Button
              title="Simpan & Masuk"
              onPress={handleSubmit}
              loading={loading}
              variant="primary"
              style={styles.buttonHalf}
            />
          )}
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
  stepper: {
    marginBottom: 16,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    gap: 14,
  },
  avatarTextCol: {
    flex: 1,
  },
  avatarName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  avatarEmail: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  summaryItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 14.5,
    color: Colors.text,
    fontWeight: '700',
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    gap: 12,
  },
  buttonHalf: {
    flex: 1,
  },
  buttonFull: {
    flex: 1,
  },
});
