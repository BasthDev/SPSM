import React, { useState, useEffect } from 'react';
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
import {
  AppHeader,
  Section,
  Input,
  Button,
  Stepper,
  Select,
  LoadingScreen,
} from '@/components';
import { authService } from '@/services/authService';
import { submissionService } from '@/services/submissionService';
import { academicService } from '@/services/academicService';
import { settingsService } from '@/services/settingsService';
import { checkTitleSimilarity, type TitleMatch } from '@/services/geminiService';
import type { OptionFormData, LecturerItem } from '@/models/types';
import { Colors } from '@/theme/theme';
import {
  Lightbulb,
  FileCheck2,
  BookMarked,
  TableProperties,
  GraduationCap,
  AlertTriangle,
  Info,
  CheckCircle2,
} from 'lucide-react-native';

const STEP_LABELS = ['Judul 1', 'Judul 2', 'Judul 3', 'Dosen', 'Kirim'];

type TitleForm = {
  title: string;
  background: string;
  journalTitle: string;
  journalAuthor: string;
  // Tabel Relevansi
  relevanceVariable: string;
  relevanceMethodology: string;
  relevanceNote: string;
};

const emptyTitle = (): TitleForm => ({
  title: '',
  background: '',
  journalTitle: '',
  journalAuthor: '',
  relevanceVariable: '',
  relevanceMethodology: '',
  relevanceNote: '',
});

export default function CreateSubmissionScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // User & Academic Data
  const [lecturers, setLecturers] = useState<LecturerItem[]>([]);
  const [isSpecialExemption, setIsSpecialExemption] = useState(false);
  const [periodStatus, setPeriodStatus] = useState<{ isOpen: boolean; reason?: string }>({
    isOpen: true,
  });

  // Candidate Advisors State
  const [preferredAdvisor1, setPreferredAdvisor1] = useState<string>('');
  const [preferredAdvisor2, setPreferredAdvisor2] = useState<string>('');

  const [titles, setTitles] = useState<TitleForm[]>([
    emptyTitle(),
    emptyTitle(),
    emptyTitle(),
  ]);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const acct = await authService.getCurrentAccount();
        const profile = await authService.getUserProfile(acct.$id);
        if (!profile) {
          router.replace('/onboarding');
          return;
        }

        if (!active) return;

        // Fetch settings, lecturers, and past submissions in parallel
        const [sysSettings, allLecs, pastSubs] = await Promise.all([
          settingsService.getSettings(),
          academicService.getLecturers(),
          submissionService.getStudentSubmissions(acct.$id),
        ]);

        if (!active) return;

        // Filter lecturers by student's department if available
        const deptLecs = allLecs.filter((l) => {
          if (!profile.department) return true;
          return (
            l.department_id?.toLowerCase() === profile.department?.toLowerCase() ||
            l.is_active
          );
        });
        setLecturers(deptLecs.length > 0 ? deptLecs : allLecs);

        // Check if student has previous revision or rejected submission
        const latestSub = pastSubs[0];
        const hasExemption =
          latestSub && (latestSub.status === 'revision' || latestSub.status === 'rejected');
        setIsSpecialExemption(Boolean(hasExemption));

        const checkPeriod = settingsService.isPeriodOpen(sysSettings);
        setPeriodStatus(checkPeriod);
      } catch (err) {
        console.error('Failed to initialize submission form', err);
      } finally {
        if (active) setInitialLoading(false);
      }
    };

    init();
    return () => {
      active = false;
    };
  }, [router]);

  if (initialLoading) {
    return <LoadingScreen message="Memeriksa periode pengajuan..." />;
  }

  const isSubmissionBlocked = !periodStatus.isOpen && !isSpecialExemption;

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
    } else if (step === 3) {
      // Step 3: Calon Dosen Pembimbing
      if (!preferredAdvisor1) {
        newErrors.advisor1 = 'Pilih Calon Dosen Pembimbing Prioritas 1';
      }
      if (!preferredAdvisor2) {
        newErrors.advisor2 = 'Pilih Calon Dosen Pembimbing Prioritas 2';
      }
      if (preferredAdvisor1 && preferredAdvisor2 && preferredAdvisor1 === preferredAdvisor2) {
        newErrors.advisor2 = 'Prioritas 1 dan Prioritas 2 tidak boleh dosen yang sama';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (isSubmissionBlocked) {
      Alert.alert('Perhatian', periodStatus.reason || 'Masa pengajuan belum dibuka.');
      return;
    }

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
    if (isSubmissionBlocked) {
      Alert.alert('Perhatian', periodStatus.reason || 'Masa pengajuan telah berakhir.');
      return;
    }

    setLoading(true);
    try {
      const acct = await authService.getCurrentAccount();
      const optionsData: OptionFormData[] = titles.map((t, i) => ({
        number: i + 1,
        title: t.title.trim(),
        background: t.background.trim(),
        journalTitle: t.journalTitle.trim() || undefined,
        journalAuthor: t.journalAuthor.trim() || undefined,
        relevanceVariable: t.relevanceVariable.trim() || undefined,
        relevanceMethodology: t.relevanceMethodology.trim() || undefined,
        relevanceNote: t.relevanceNote.trim() || undefined,
      }));

      // Cek kemiripan judul dengan pengajuan yang sudah ada (AI + exact match)
      try {
        const existingTitles = await submissionService.getComparableTitles();
        const report = await checkTitleSimilarity(
          optionsData.map((o) => o.title),
          existingTitles
        );

        if (report.matches.length > 0) {
          const formatList = (ms: TitleMatch[]) =>
            ms
              .map(
                (m) =>
                  `• "${m.newTitle}"\n  Mirip dengan: "${m.matchedTitle}"${m.reason ? ` (${m.reason})` : ''}`
              )
              .join('\n\n');

          const blocking = report.matches.filter((m) => m.level === 'tinggi');
          const warning = report.matches.filter((m) => m.level === 'sedang');

          if (blocking.length > 0) {
            Alert.alert(
              'Judul Sudah Ada / Sangat Mirip',
              `Pengajuan dibatalkan karena ada judul yang sudah ada atau sangat mirip dengan judul lain:\n\n${formatList(blocking)}`,
              [{ text: 'Mengerti' }]
            );
            return;
          }

          if (warning.length > 0) {
            const proceed = await new Promise<boolean>((resolve) => {
              Alert.alert(
                'Peringatan Kemiripan Judul',
                `Beberapa judul mirip dengan yang sudah diajukan mahasiswa lain:\n\n${formatList(warning)}\n\nApakah Anda tetap ingin mengajukan?`,
                [
                  { text: 'Kembali & Perbaiki', style: 'cancel', onPress: () => resolve(false) },
                  { text: 'Tetap Ajukan', onPress: () => resolve(true) },
                ]
              );
            });
            if (!proceed) return;
          }
        }
      } catch (checkErr) {
        // Jangan blokir pengajuan jika pengecekan gagal
        console.warn('Similarity check skipped:', checkErr);
      }

      await submissionService.createSubmission(
        acct.$id,
        optionsData,
        preferredAdvisor1,
        preferredAdvisor2
      );

      Alert.alert('Berhasil! 🎉', 'Pengajuan proposal 3 opsi judul skripsi berhasil dikirim.', [
        { text: 'Buka Dashboard', onPress: () => router.replace('/dashboard') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal mengirim pengajuan.');
    } finally {
      setLoading(false);
    }
  };

  // Lecturer options for Select dropdown
  const lecturerSelectOptions = lecturers.map((lec) => ({
    label: lec.name,
    value: lec.$id,
    subtitle: `NIP: ${lec.nip} • Sisa Kuota: ${Math.max(0, (lec.quota || 10) - (lec.current_students || 0))}`,
  }));

  const selectedLec1 = lecturers.find((l) => l.$id === preferredAdvisor1);
  const selectedLec2 = lecturers.find((l) => l.$id === preferredAdvisor2);

  // Render Step 0, 1, 2: Form Opsi Judul + Tabel Relevansi
  const renderTitleForm = (index: number) => {
    const t = titles[index];
    return (
      <Section>
        <View style={styles.stepHeaderRow}>
          <View style={styles.iconCircle}>
            <Lightbulb size={18} color={Colors.primary} strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Opsi Judul Ke-{index + 1}</Text>
            <Text style={styles.sectionSubtitle}>
              Isi gagasan, latar belakang, dan tabel relevansi jurnal
            </Text>
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
          label="Latar Belakang Masalah & Urgensi"
          value={t.background}
          onChangeText={(v) => updateTitle(index, 'background', v)}
          placeholder="Jelaskan fenomena masalah, urgensi, dan celah penelitian yang ingin diselesaikan..."
          multiline
          numberOfLines={4}
          style={styles.textArea}
          error={errors.background}
        />

        {/* Referensi Jurnal Acuan */}
        <View style={styles.journalHeader}>
          <BookMarked size={15} color={Colors.textSecondary} strokeWidth={2.2} />
          <Text style={styles.journalSectionLabel}>Referensi Jurnal Acuan (Opsional)</Text>
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

        {/* Tabel Relevansi Penelitian (Spesifikasi v2.0) */}
        <View style={styles.relevanceBox}>
          <View style={styles.relevanceHeaderRow}>
            <TableProperties size={16} color={Colors.primary} strokeWidth={2.2} />
            <Text style={styles.relevanceBoxTitle}>Tabel Relevansi Penelitian</Text>
          </View>
          <Text style={styles.relevanceBoxSub}>
            Ukur kecocokan variabel dan metodologi jurnal dengan penelitian Anda
          </Text>

          <Input
            label="1. Variabel / Fokus Penelitian"
            value={t.relevanceVariable}
            onChangeText={(v) => updateTitle(index, 'relevanceVariable', v)}
            placeholder="Apa variabel, subjek, atau fokus yang diteliti?"
            style={styles.relevanceInput}
          />

          <Input
            label="2. Metodologi Jurnal Acuan"
            value={t.relevanceMethodology}
            onChangeText={(v) => updateTitle(index, 'relevanceMethodology', v)}
            placeholder="Metode atau algoritma yang digunakan dalam jurnal acuan..."
            style={styles.relevanceInput}
          />

          <Input
            label="3. Kesesuaian / Relevansi dengan Topik"
            value={t.relevanceNote}
            onChangeText={(v) => updateTitle(index, 'relevanceNote', v)}
            placeholder="Jelaskan mengapa jurnal ini relevan dan mendukung penelitian Anda..."
            multiline
            numberOfLines={2}
            style={[styles.relevanceInput, { minHeight: 60 }]}
          />
        </View>
      </Section>
    );
  };

  // Render Step 3: Pemilihan 2 Calon Dosen Pembimbing
  const renderAdvisorSelection = () => (
    <Section>
      <View style={styles.stepHeaderRow}>
        <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
          <GraduationCap size={20} color={Colors.primary} strokeWidth={2.4} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Calon Dosen Pembimbing</Text>
          <Text style={styles.sectionSubtitle}>
            Pilih 2 calon Dosen Pembimbing sebagai preferensi awal untuk Reviewer
          </Text>
        </View>
      </View>

      <View style={styles.advisorInfoNote}>
        <Info size={16} color={Colors.primary} strokeWidth={2.2} />
        <Text style={styles.advisorInfoNoteText}>
          Pilihan ini menjadi referensi awal bagi Dosen Reviewer dan Kaprodi dalam menetapkan
          Dosen Pembimbing 1 dan 2.
        </Text>
      </View>

      {/* Prioritas 1 */}
      <View style={styles.advisorPickerBlock}>
        <Text style={styles.advisorPickerTitle}>1. Calon Pembimbing (Prioritas 1)</Text>
        <Select
          label="Pilih Dosen Prioritas 1"
          value={preferredAdvisor1}
          options={lecturerSelectOptions}
          onValueChange={setPreferredAdvisor1}
          placeholder="-- Pilih Dosen Pembimbing 1 --"
          error={errors.advisor1}
        />
        {selectedLec1 && (
          <View style={styles.selectedAdvisorCard}>
            <Text style={styles.selectedAdvisorName}>{selectedLec1.name}</Text>
            <Text style={styles.selectedAdvisorNip}>NIP: {selectedLec1.nip}</Text>
            <Text style={styles.selectedAdvisorField}>
              Bidang: {selectedLec1.expertise || 'Umum'}
            </Text>
          </View>
        )}
      </View>

      {/* Prioritas 2 */}
      <View style={styles.advisorPickerBlock}>
        <Text style={styles.advisorPickerTitle}>2. Calon Pembimbing (Prioritas 2)</Text>
        <Select
          label="Pilih Dosen Prioritas 2"
          value={preferredAdvisor2}
          options={lecturerSelectOptions}
          onValueChange={setPreferredAdvisor2}
          placeholder="-- Pilih Dosen Pembimbing 2 --"
          error={errors.advisor2}
        />
        {selectedLec2 && (
          <View style={styles.selectedAdvisorCard}>
            <Text style={styles.selectedAdvisorName}>{selectedLec2.name}</Text>
            <Text style={styles.selectedAdvisorNip}>NIP: {selectedLec2.nip}</Text>
            <Text style={styles.selectedAdvisorField}>
              Bidang: {selectedLec2.expertise || 'Umum'}
            </Text>
          </View>
        )}
      </View>
    </Section>
  );

  // Render Step 4: Ringkasan Pengajuan Lengkap
  const renderSummary = () => (
    <Section>
      <View style={styles.stepHeaderRow}>
        <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
          <FileCheck2 size={18} color="#059669" strokeWidth={2.4} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Ringkasan Pengajuan Proposal</Text>
          <Text style={styles.sectionSubtitle}>
            Periksa seluruh 3 opsi judul dan 2 pilihan dosen sebelum dikirim
          </Text>
        </View>
      </View>

      {/* Preferensi Dosen Pembimbing */}
      <View style={styles.summaryAdvisorsBox}>
        <Text style={styles.summarySectionHeading}>Calon Dosen Pembimbing Pilihan</Text>
        <View style={styles.summaryAdvisorRow}>
          <Text style={styles.summaryAdvisorLabel}>Prioritas 1:</Text>
          <Text style={styles.summaryAdvisorVal}>{selectedLec1?.name || '(Belum dipilih)'}</Text>
        </View>
        <View style={styles.summaryAdvisorRow}>
          <Text style={styles.summaryAdvisorLabel}>Prioritas 2:</Text>
          <Text style={styles.summaryAdvisorVal}>{selectedLec2?.name || '(Belum dipilih)'}</Text>
        </View>
      </View>

      {/* 3 Opsi Judul */}
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
              <Text style={styles.journalSummaryLabel}>Jurnal Acuan:</Text>
              <Text style={styles.journalSummaryValue}>
                {t.journalTitle} {t.journalAuthor ? `— ${t.journalAuthor}` : ''}
              </Text>
            </View>
          ) : null}

          {/* Tabel Relevansi Summary */}
          {(t.relevanceVariable || t.relevanceMethodology || t.relevanceNote) && (
            <View style={styles.relevanceSummaryBox}>
              <Text style={styles.relevanceSummaryTitle}>Tabel Relevansi:</Text>
              {t.relevanceVariable ? (
                <Text style={styles.relevanceSummaryItem}>
                  • <Text style={styles.boldText}>Variabel:</Text> {t.relevanceVariable}
                </Text>
              ) : null}
              {t.relevanceMethodology ? (
                <Text style={styles.relevanceSummaryItem}>
                  • <Text style={styles.boldText}>Metodologi:</Text> {t.relevanceMethodology}
                </Text>
              ) : null}
              {t.relevanceNote ? (
                <Text style={styles.relevanceSummaryItem}>
                  • <Text style={styles.boldText}>Kesesuaian:</Text> {t.relevanceNote}
                </Text>
              ) : null}
            </View>
          )}
        </View>
      ))}
    </Section>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title="Pengajuan Judul Skripsi" showBack onBack={handleHeaderBack} />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Banner Status Masa Pengajuan */}
        {isSpecialExemption ? (
          <View style={styles.exemptionBanner}>
            <CheckCircle2 size={18} color="#059669" strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text style={styles.exemptionBannerTitle}>Hak Akses Pengajuan Ulang</Text>
              <Text style={styles.exemptionBannerSub}>
                Status pengajuan Anda sebelumnya adalah revisi/ditolak. Anda diizinkan membuat
                pengajuan proposal baru kapan saja.
              </Text>
            </View>
          </View>
        ) : isSubmissionBlocked ? (
          <View style={styles.blockedBanner}>
            <AlertTriangle size={20} color="#DC2626" strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text style={styles.blockedBannerTitle}>Masa Pengajuan Ditutup</Text>
              <Text style={styles.blockedBannerSub}>
                {periodStatus.reason ||
                  'Masa pengajuan judul skripsi belum dibuka atau telah berakhir oleh Administrator.'}
              </Text>
            </View>
          </View>
        ) : null}

        <Stepper steps={STEP_LABELS} currentStep={step} style={styles.stepper} />

        {step < 3 ? renderTitleForm(step) : step === 3 ? renderAdvisorSelection() : renderSummary()}

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
          {step < 4 ? (
            <Button
              title="Lanjut"
              onPress={handleNext}
              variant="primary"
              disabled={isSubmissionBlocked}
              style={[styles.btnHalf, step === 0 && styles.btnFull]}
            />
          ) : (
            <Button
              title="Kirim Pengajuan"
              onPress={handleSubmit}
              loading={loading}
              disabled={isSubmissionBlocked}
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
    padding: 16,
    paddingBottom: 40,
  },
  stepper: {
    marginBottom: 14,
  },
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  blockedBannerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#991B1B',
  },
  blockedBannerSub: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
    lineHeight: 17,
  },
  exemptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  exemptionBannerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#065F46',
  },
  exemptionBannerSub: {
    fontSize: 12,
    color: '#047857',
    marginTop: 2,
    lineHeight: 17,
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
    borderRadius: 12,
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
    minHeight: 100,
    textAlignVertical: 'top',
  },
  journalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 8,
  },
  journalSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Tabel Relevansi Box
  relevanceBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  relevanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  relevanceBoxTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: Colors.primary,
  },
  relevanceBoxSub: {
    fontSize: 11.5,
    color: Colors.textTertiary,
    marginTop: 2,
    marginBottom: 12,
  },
  relevanceInput: {
    backgroundColor: '#FFFFFF',
    fontSize: 13,
  },

  // Calon Dosen Pembimbing Step
  advisorInfoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  advisorInfoNoteText: {
    fontSize: 12,
    color: '#1E40AF',
    flex: 1,
    lineHeight: 17,
  },
  advisorPickerBlock: {
    marginBottom: 16,
  },
  advisorPickerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
  },
  selectedAdvisorCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectedAdvisorName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: Colors.text,
  },
  selectedAdvisorNip: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  selectedAdvisorField: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },

  // Summary Step
  summaryAdvisorsBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  summarySectionHeading: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  summaryAdvisorRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  summaryAdvisorLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  summaryAdvisorVal: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1E40AF',
    flex: 1,
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
  relevanceSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  relevanceSummaryTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  relevanceSummaryItem: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  boldText: {
    fontWeight: '700',
    color: Colors.text,
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
