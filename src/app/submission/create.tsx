import React, { useState } from 'react';
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
import { AppHeader, Section, Input, Button, Stepper } from '@/components';
import { authService } from '@/services/authService';
import { submissionService } from '@/services/submissionService';
import type { OptionFormData } from '@/models/types';
import { Colors } from '@/theme/theme';
import { Lightbulb, FileCheck2, BookMarked } from 'lucide-react-native';

const STEP_LABELS = ['Judul 1', 'Judul 2', 'Judul 3', 'Kirim'];

type TitleForm = {
  title: string;
  background: string;
  journalTitle: string;
  journalAuthor: string;
};

const emptyTitle = (): TitleForm => ({
  title: '',
  background: '',
  journalTitle: '',
  journalAuthor: '',
});

export default function CreateSubmissionScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [titles, setTitles] = useState<TitleForm[]>([
    emptyTitle(),
    emptyTitle(),
    emptyTitle(),
  ]);

  const updateTitle = (index: number, field: keyof TitleForm, value: string) => {
    setTitles((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (step < 3) {
      const t = titles[step];
      if (!t.title.trim()) newErrors.title = 'Judul skripsi wajib diisi';
      if (!t.background.trim()) newErrors.background = 'Latar belakang masalah wajib diisi';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
    }
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleHeaderBack = () => {
    if (step > 0) {
      setStep((s) => s - 1);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/dashboard');
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const acct = await authService.getCurrentAccount();
      const optionsData: OptionFormData[] = titles.map((t, i) => ({
        number: i + 1,
        title: t.title.trim(),
        background: t.background.trim(),
        journalTitle: t.journalTitle.trim() || undefined,
        journalAuthor: t.journalAuthor.trim() || undefined,
      }));

      await submissionService.createSubmission(acct.$id, optionsData);
      Alert.alert('Berhasil! 🎉', 'Pengajuan 3 opsi judul skripsi berhasil dikirim.', [
        { text: 'Buka Dashboard', onPress: () => router.replace('/dashboard') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal mengirim pengajuan.');
    } finally {
      setLoading(false);
    }
  };

  const renderTitleForm = (index: number) => {
    const t = titles[index];
    return (
      <Section>
        <View style={styles.stepHeaderRow}>
          <View style={styles.iconCircle}>
            <Lightbulb size={18} color={Colors.primary} strokeWidth={2.4} />
          </View>
          <View>
            <Text style={styles.sectionTitle}>Opsi Judul Ke-{index + 1}</Text>
            <Text style={styles.sectionSubtitle}>Isi gagasan dan latar belakang penelitian</Text>
          </View>
        </View>

        <Input
          label="Judul Skripsi"
          value={t.title}
          onChangeText={(v) => updateTitle(index, 'title', v)}
          placeholder="Contoh: Implementasi Algoritma X untuk Analisis Y..."
          multiline
          error={errors.title}
        />

        <Input
          label="Latar Belakang Masalah"
          value={t.background}
          onChangeText={(v) => updateTitle(index, 'background', v)}
          placeholder="Jelaskan fenomena masalah, urgensi, dan celah penelitian yang ingin diselesaikan..."
          multiline
          numberOfLines={4}
          style={styles.textArea}
          error={errors.background}
        />

        <View style={styles.journalHeader}>
          <BookMarked size={15} color={Colors.textTertiary} strokeWidth={2} />
          <Text style={styles.journalSectionLabel}>Referensi Jurnal Pendukung (Opsional)</Text>
        </View>

        <Input
          label="Judul Jurnal Referensi"
          value={t.journalTitle}
          onChangeText={(v) => updateTitle(index, 'journalTitle', v)}
          placeholder="Judul paper atau jurnal acuan utama"
        />

        <Input
          label="Penulis / Tahun Jurnal"
          value={t.journalAuthor}
          onChangeText={(v) => updateTitle(index, 'journalAuthor', v)}
          placeholder="Contoh: John Doe et al. (2024)"
        />
      </Section>
    );
  };

  const renderSummary = () => (
    <Section>
      <View style={styles.stepHeaderRow}>
        <View style={[styles.iconCircle, { backgroundColor: Colors.successLight }]}>
          <FileCheck2 size={18} color={Colors.success} strokeWidth={2.4} />
        </View>
        <View>
          <Text style={styles.sectionTitle}>Ringkasan 3 Opsi Judul</Text>
          <Text style={styles.sectionSubtitle}>Pastikan seluruh judul sudah sesuai sebelum dikirim</Text>
        </View>
      </View>

      {titles.map((t, i) => (
        <View key={i} style={styles.summaryItem}>
          <View style={styles.optionBadge}>
            <Text style={styles.optionBadgeText}>Opsi #{i + 1}</Text>
          </View>
          <Text style={styles.summaryTitleText}>{t.title || '(belum diisi)'}</Text>
          <Text style={styles.summaryBgText} numberOfLines={3}>
            {t.background || '(belum diisi)'}
          </Text>
          {t.journalTitle ? (
            <View style={styles.journalSummaryRow}>
              <Text style={styles.journalSummaryLabel}>Jurnal:</Text>
              <Text style={styles.journalSummaryValue}>
                {t.journalTitle} {t.journalAuthor ? `— ${t.journalAuthor}` : ''}
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </Section>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title="Pengajuan Judul" showBack onBack={handleHeaderBack} />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Stepper steps={STEP_LABELS} currentStep={step} style={styles.stepper} />

        {step < 3 ? renderTitleForm(step) : renderSummary()}

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          {step > 0 && (
            <Button
              title="Kembali"
              onPress={handleBack}
              variant="secondary"
              style={styles.btnHalf}
            />
          )}
          {step < 3 ? (
            <Button
              title="Lanjut"
              onPress={handleNext}
              variant="primary"
              style={[styles.btnHalf, step === 0 && styles.btnFull]}
            />
          ) : (
            <Button
              title="Kirim Pengajuan"
              onPress={handleSubmit}
              loading={loading}
              variant="primary"
              style={styles.btnHalf}
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
    marginBottom: 14,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  journalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 10,
  },
  journalSectionLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  optionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    marginBottom: 6,
  },
  optionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  summaryTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  summaryBgText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  journalSummaryRow: {
    flexDirection: 'row',
    marginTop: 6,
    flexWrap: 'wrap',
    gap: 4,
  },
  journalSummaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  journalSummaryValue: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  btnHalf: {
    flex: 1,
  },
  btnFull: {
    flex: 1,
  },
});
