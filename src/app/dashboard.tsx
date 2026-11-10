import {
  Button,
  Card,
  EmptyState,
  HomeHeader,
  LoadingScreen,
  StatusBadge,
} from '@/components';
import type { ThesisSubmission, UserProfile, DepartmentItem } from '@/models/types';
import { FALLBACK_DEPARTMENTS } from '@/models/types';
import { authService } from '@/services/authService';
import { submissionService } from '@/services/submissionService';
import { academicService } from '@/services/academicService';
import { settingsService, type SystemSettings } from '@/services/settingsService';
import { Colors } from '@/theme/theme';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  PlusCircle,
  ShieldCheck,
  UserCheck,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function DashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [submissions, setSubmissions] = useState<ThesisSubmission[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // Function to load all dashboard data freshly from Appwrite
  const loadDashboardData = useCallback(async (isInitial = false) => {
    try {
      const acct = await authService.getCurrentAccount();
      const profile = await authService.getUserProfile(acct.$id);

      if (!profile) {
        router.replace('/onboarding');
        return;
      }

      setUser(profile);

      // Fetch submissions, master departments, and system settings simultaneously
      const [subs, depts, sysSettings] = await Promise.all([
        submissionService.getStudentSubmissionsWithDetails(acct.$id),
        academicService.getDepartments(),
        settingsService.getSettings(),
      ]);
      setSubmissions(subs);
      setSettings(sysSettings);
      if (depts && depts.length > 0) {
        setDepartments(depts);
      }
    } catch {
      if (isInitial) {
        router.replace('/login');
      }
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, [router]);

  // useFocusEffect automatically refetches the latest status every time the screen is displayed
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (active) {
        loadDashboardData(loading);
      }
      return () => {
        active = false;
      };
    }, [loadDashboardData, loading])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboardData(false);
    setRefreshing(false);
  }, [loadDashboardData]);

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

  if (loading) return <LoadingScreen message="Memuat dashboard..." />;

  // Resolve full department name (not code)
  const getDepartmentFullName = (deptCodeOrName?: string) => {
    if (!deptCodeOrName) return 'Program Studi Mahasiswa';
    const found = departments.find(
      (d) =>
        d.code.toLowerCase() === deptCodeOrName.toLowerCase() ||
        d.name.toLowerCase() === deptCodeOrName.toLowerCase()
    );
    if (found) return found.name;
    const fallback = FALLBACK_DEPARTMENTS.find(
      (d) => d.value.toLowerCase() === deptCodeOrName.toLowerCase()
    );
    if (fallback) {
      return fallback.label.split('(')[0].trim();
    }
    return deptCodeOrName.replace(/_/g, ' ');
  };

  const departmentFullName = getDepartmentFullName(user?.department);

  // Guard: Hide submission button if there is an active / non-rejected submission
  const activeSubmission = submissions.find((s) => s.status !== 'rejected' && s.status !== 'revision');
  
  // Exemption check: student whose previous submission is revision or rejected can ALWAYS submit
  const latestSub = submissions[0];
  const hasExemption = latestSub && (latestSub.status === 'revision' || latestSub.status === 'rejected');
  const periodStatus = settings ? settingsService.isPeriodOpen(settings) : { isOpen: true };
  const canSubmitNew = !activeSubmission && (periodStatus.isOpen || hasExemption);
  const showClosedBanner = !activeSubmission && !periodStatus.isOpen && !hasExemption;

  return (
    <View style={styles.flex}>
      {/* Formal Academic Header: Nama, NIM, Nama Lengkap Program Studi */}
      <HomeHeader
        userName={user?.name}
        userNim={user?.nim_or_nip}
        userDepartmentName={departmentFullName}
        avatarUrl={user?.avatar_url}
        onProfilePress={() => router.push('/profile')}
        onSignOutPress={handleSignOut}
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Closed Period Banner (if submission period closed and no exemption) */}
        {showClosedBanner && (
          <Card
            variant="elevated"
            borderRadius={20}
            padding={16}
            style={styles.closedPeriodCard}
          >
            <View style={styles.closedPeriodRow}>
              <View style={styles.closedPeriodIconCircle}>
                <Clock size={24} color="#D97706" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.closedPeriodTitle}>Masa Pengajuan Ditutup</Text>
                <Text style={styles.closedPeriodDesc}>
                  {periodStatus.reason || 'Masa pengajuan judul skripsi belum dibuka atau telah berakhir.'}
                </Text>
                {settings?.academic_year && (
                  <Text style={styles.closedPeriodYear}>
                    Tahun Akademik: {settings.academic_year}
                  </Text>
                )}
              </View>
            </View>
          </Card>
        )}

        {/* 1. HERO ACTION: Conditional Button OR Detailed Live Status Banner */}
        {canSubmitNew ? (
          <Card
            variant="elevated"
            borderRadius={24}
            padding={20}
            style={styles.heroCard}
            onPress={() => router.push('/submission/create' as any)}
          >
            <View style={styles.heroRow}>
              <View style={styles.heroIconCircle}>
                <PlusCircle size={26} color={Colors.primary} strokeWidth={2.2} />
              </View>
              <View style={styles.heroTextCol}>
                <Text style={styles.heroTitle}>Ajukan Judul Skripsi</Text>
                <Text style={styles.heroSubtitle}>
                  Kirimkan 3 opsi judul skripsi untuk direview oleh Dosen Penilai & Kaprodi
                </Text>
              </View>
              <View style={styles.heroChevron}>
                <ChevronRight size={20} color={Colors.primary} strokeWidth={2.4} />
              </View>
            </View>
          </Card>
        ) : activeSubmission ? (
          /* Live Status Card for Active Submission */
          <Card
            variant="elevated"
            borderRadius={24}
            padding={20}
            style={[
              styles.activeSubmissionCard,
              activeSubmission.status === 'approved' && styles.cardApproved,
              activeSubmission.status === 'waiting_kaprodi' && styles.cardWaitingKaprodi,
              activeSubmission.status === 'revision' && styles.cardRevision,
            ]}
            onPress={() => router.push(`/submission/${activeSubmission.$id}` as any)}
          >
            {/* Top Bar: Category Pill & Status Badge */}
            <View style={styles.activeTopMetaRow}>
              <View style={styles.activeCategoryPill}>
                {activeSubmission.status === 'approved' ? (
                  <Award size={15} color="#059669" strokeWidth={2.4} />
                ) : activeSubmission.status === 'waiting_kaprodi' ? (
                  <ShieldCheck size={15} color="#0A4C8F" strokeWidth={2.4} />
                ) : activeSubmission.status === 'revision' ? (
                  <AlertTriangle size={15} color="#D97706" strokeWidth={2.4} />
                ) : (
                  <Clock size={15} color={Colors.primary} strokeWidth={2.4} />
                )}
                <Text
                  style={[
                    styles.activeCategoryLabel,
                    activeSubmission.status === 'approved' && { color: '#059669' },
                    activeSubmission.status === 'waiting_kaprodi' && { color: '#0A4C8F' },
                    activeSubmission.status === 'revision' && { color: '#D97706' },
                  ]}
                >
                  {activeSubmission.status === 'approved'
                    ? 'SK PENGESAHAN RESMI'
                    : activeSubmission.status === 'waiting_kaprodi'
                    ? 'PROSES PENGESAHAN KAPRODI'
                    : activeSubmission.status === 'revision'
                    ? 'PERLU PERBAIKAN / REVISI'
                    : 'SEDANG DIPERIKSA REVIEWER'}
                </Text>
              </View>

              <StatusBadge status={activeSubmission.status} size="sm" />
            </View>

            {/* Main Heading: Full width! */}
            <Text style={styles.activeMainHeading}>
              {activeSubmission.status === 'approved'
                ? 'Judul & Dosen Pembimbing Resmi Disahkan'
                : activeSubmission.status === 'waiting_kaprodi'
                ? 'Menunggu Pengesahan Kaprodi'
                : activeSubmission.status === 'revision'
                ? 'Revisi Usulan Judul Skripsi'
                : 'Dalam Antrean Review Dosen Penilai'}
            </Text>

            {/* Middle Section: Display Full Chosen Title (no truncation) */}
            {activeSubmission.selectedOption ? (
              <View style={styles.highlightChosenBox}>
                <Text style={styles.highlightBoxLabel}>Judul Skripsi Terpilih:</Text>
                <Text style={styles.highlightChosenTitle}>
                  {activeSubmission.selectedOption.title}
                </Text>
              </View>
            ) : null}

            {/* Advisor & Date Information */}
            {activeSubmission.status !== 'revision' && activeSubmission.status !== 'rejected' && (<View style={styles.activeMetaGrid}>
              {activeSubmission.advisor ? (
                <View style={styles.activeMetaItem}>
                  <GraduationCap size={15} color={Colors.primary} strokeWidth={2.2} />
                  <Text style={styles.activeMetaText} numberOfLines={1}>
                    Pembimbing: <Text style={styles.boldText}>{activeSubmission.advisor.name}</Text>
                  </Text>
                </View>
              ) : (
                <View style={styles.activeMetaItem}>
                  <Clock size={15} color={Colors.textTertiary} strokeWidth={2} />
                  <Text style={styles.activeMetaText}>Pembimbing: Sedang diplot reviewer</Text>
                </View>
              )}

              {activeSubmission.kaprodiApprovalDate ? (
                <View style={styles.activeMetaItem}>
                  <CheckCircle2 size={15} color="#059669" strokeWidth={2.2} />
                  <Text style={styles.activeMetaText}>
                    Disahkan:{' '}
                    <Text style={[styles.boldText, { color: '#059669' }]}>
                      {new Date(activeSubmission.kaprodiApprovalDate).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </Text>
                </View>
              ) : null}
            </View>
            )}
            {/* Bottom action prompt */}
            <View style={styles.activeCardFooter}>
              <Text style={styles.activeFooterActionText}>
                {activeSubmission.status === 'approved'
                  ? 'Buka Lembar Pengesahan & Detail Bimbingan'
                  : 'Lihat Detail Status & Catatan Penilai'}
              </Text>
              <ChevronRight size={16} color={Colors.primary} strokeWidth={2.4} />
            </View>
          </Card>
        ) : null}

        {/* 2. SECTION HEADER */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Riwayat Pengajuan</Text>
            <Text style={styles.sectionSubtitle}>Daftar dan status terkini pengajuan skripsi Anda</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{submissions.length}</Text>
          </View>
        </View>

        {/* 3. SUBMISSIONS LIST */}
        {submissions.length === 0 ? (
          <EmptyState
            title="Belum Ada Pengajuan"
            subtitle="Anda belum memiliki riwayat pengajuan judul. Klik tombol di atas untuk mengajukan 3 usulan judul skripsi."
            icon={<FileText size={32} color={Colors.primary} strokeWidth={2} />}
            action={
              <Button
                title="Mulai Pengajuan Baru"
                onPress={() => router.push('/submission/create' as any)}
                variant="primary"
                size="sm"
                style={{ marginTop: 8 }}
              />
            }
          />
        ) : (
          submissions.map((sub, index) => {
            const dateStr = new Date(sub.submitted_at).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });

            const displayTitle =
              sub.selectedOption?.title ||
              sub.options?.[0]?.title ||
              'Usulan 3 Opsi Judul Skripsi';

            return (
              <Card
                key={sub.$id}
                onPress={() => router.push(`/submission/${sub.$id}` as any)}
                borderRadius={20}
                padding={16}
                style={styles.submissionCard}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.submissionIndexBadge}>
                    <Text style={styles.submissionIndexText}>
                      Pengajuan #{submissions.length - index}
                    </Text>
                  </View>
                  <StatusBadge status={sub.status} size="sm" />
                </View>

                {/* Title Highlight - Show Full Title */}
                <Text style={styles.cardThesisTitle}>
                  {displayTitle}
                </Text>

                <View style={styles.cardDivider} />

                {/* Meta details */}
                <View style={styles.cardInfoRow}>
                  <View style={styles.infoItem}>
                    <Calendar size={13} color={Colors.textTertiary} strokeWidth={2} />
                    <Text style={styles.infoText}>{dateStr}</Text>
                  </View>

                  {sub.status !== 'revision' && sub.status !== 'rejected' && (
                    sub.advisor ? (
                      <View style={styles.infoItem}>
                        <UserCheck size={13} color={Colors.success} strokeWidth={2} />
                        <Text style={[styles.infoText, { color: Colors.success, fontWeight: '700' }]} numberOfLines={1}>
                          {sub.advisor.name}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.infoItem}>
                        <Clock size={13} color={Colors.warning} strokeWidth={2} />
                        <Text style={[styles.infoText, { color: Colors.warning, fontWeight: '600' }]}>
                          Menunggu Plotting
                        </Text>
                      </View>
                    )
                  )}
                </View>

                {/* Card Action Link */}
                <View style={styles.cardFooter}>
                  <Text style={styles.detailLinkText}>Buka Detail Pengajuan & SK</Text>
                  <ChevronRight size={15} color={Colors.primary} strokeWidth={2.4} />
                </View>
              </Card>
            );
          })
        )}
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
  heroCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#E0F2FE',
    marginBottom: 24,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextCol: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  heroChevron: {
    paddingLeft: 4,
  },

  // Active submission detailed card
  activeSubmissionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    marginBottom: 24,
  },
  cardApproved: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  cardWaitingKaprodi: {
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
  },
  cardRevision: {
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
  },
  activeTopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    width: '100%',
  },
  activeCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeCategoryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.6,
  },
  activeMainHeading: {
    fontSize: 16.5,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
    marginBottom: 12,
    lineHeight: 23,
    width: '100%',
  },
  highlightChosenBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  highlightBoxLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  highlightChosenTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 18,
  },
  activeMetaGrid: {
    gap: 6,
    marginBottom: 12,
  },
  activeMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeMetaText: {
    fontSize: 12,
    color: '#475569',
  },
  boldText: {
    fontWeight: '700',
    color: Colors.text,
  },
  activeCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  activeFooterActionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primary,
  },

  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  countText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },

  // Closed Period Banner
  closedPeriodCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    marginBottom: 16,
  },
  closedPeriodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closedPeriodIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedPeriodTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  closedPeriodDesc: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16,
  },
  closedPeriodYear: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78350F',
    marginTop: 4,
  },

  // Submissions list card
  submissionCard: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  submissionIndexBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  submissionIndexText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  cardThesisTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 19,
    marginBottom: 10,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 10,
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '55%',
  },
  infoText: {
    fontSize: 11.5,
    color: Colors.textTertiary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  detailLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
});
