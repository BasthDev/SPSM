import {
  Button,
  Carousel,
  ClosedPeriodCard,
  EligibilityCard,
  EmptyState,
  GridNav,
  HeroSubmitCard,
  HomeHeader,
  LoadingScreen,
  PeriodInfoCard,
  Section,
  StatusBadge
} from '@/components';
import { DashboardSubmissionCard } from '@/components/DashboardSubmissionCard';
import type { DepartmentItem, ThesisSubmission, UserProfile } from '@/models/types';
import { FALLBACK_DEPARTMENTS, isActiveSubmissionStatus } from '@/models/types';
import { academicService } from '@/services/academicService';
import { authService } from '@/services/authService';
import { settingsService, type SystemSettings } from '@/services/settingsService';
import { syncPushRegistrationIfEnabled } from '@/services/notificationService';
import { disconnectRealtime, onRealtimeEvent } from '@/services/realtimeService';
import { submissionService } from '@/services/submissionService';
import { userDataCache } from '@/services/userDataCache';
import { Colors } from '@/theme/theme';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  FileText,
  GraduationCap,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,

  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function DashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [submissions, setSubmissions] = useState<ThesisSubmission[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  // Load dashboard data: render from local cache instantly, then refresh from API
  const loadDashboardData = useCallback(async (isInitial = false) => {
    try {
      const acct = await authService.getCurrentAccount();

      // 1. Serve cached snapshot immediately so UI renders without network wait
      const cached = await userDataCache.get(acct.$id);
      if (cached) {
        setUser(cached.profile);
        setSubmissions(cached.submissions);
        if (cached.departments?.length) setDepartments(cached.departments);
        if (cached.settings) setSettings(cached.settings);
        if (isInitial) setLoading(false);
      }

      // 2. Fetch fresh data from API
      const profile = await authService.getUserProfile(acct.$id);

      if (!profile) {
        router.replace('/onboarding');
        return;
      }

      setUser(profile);
      void syncPushRegistrationIfEnabled();

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

      // 3. Persist fresh snapshot for next app open
      void userDataCache.set(acct.$id, {
        profile,
        submissions: subs,
        departments: depts || [],
        settings: sysSettings,
      });
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
  const didInitialLoad = useRef(false);
  useFocusEffect(
    useCallback(() => {
      loadDashboardData(!didInitialLoad.current);
      didInitialLoad.current = true;
    }, [loadDashboardData])
  );

  // Realtime: silent refetch (debounced) saat ada perubahan data relevan.
  // Server sudah memfilter event per user, jadi semua event yang sampai
  // di socket ini memang milik user yang sedang login.
  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const unsubscribe = onRealtimeEvent((event) => {
      if (event.type === 'ready' || event.type === 'pong') return;
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
      realtimeTimer.current = setTimeout(() => {
        realtimeTimer.current = null;
        void loadDashboardData(false);
      }, 800);
    });
    return () => {
      unsubscribe();
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
    };
  }, [loadDashboardData]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Apakah Anda yakin ingin keluar dari akun ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          const acct = await authService.getCurrentAccount().catch(() => null);
          if (acct) void userDataCache.clear(acct.$id);
          disconnectRealtime();
          await authService.logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const toggleCardExpansion = useCallback((cardId: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  }, []);

  // Resolve full department name (not code)
  const departmentFullName = useMemo(() => {
    const deptCodeOrName = user?.department;
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
  }, [user?.department, departments]);

  // Evaluate Period Display Status & Student Academic Eligibility
  const periodDisplay = useMemo(
    () =>
      settings
        ? settingsService.getPeriodDisplayStatus(settings)
        : {
            status: 'open' as const,
            title: 'Masa Pengajuan Dibuka',
            description: 'Pendaftaran judul skripsi aktif.',
            dateRangeText: '',
            academicYear: '2025/2026 Ganjil',
            isOpen: true,
          },
    [settings]
  );

  const eligibility = useMemo(
    () =>
      settings
        ? settingsService.evaluateStudentEligibility(settings, user)
        : {
            isEligible: true,
            studentSks: 0,
            minSks: 100,
            sksSatisfied: true,
            requiredCourses: [],
            completedCourses: [],
            missingCourses: [],
            coursesSatisfied: true,
            reasons: [],
          },
    [settings, user]
  );

  // Guard: Hide submission button if there is an active / non-rejected submission
  const activeSubmission = useMemo(
    () => submissions.find((s) => isActiveSubmissionStatus(s.status)),
    [submissions]
  );

  // Exemption check: student whose previous submission is revision or rejected can ALWAYS submit
  const latestSub = submissions[0];
  const hasExemption = useMemo(
    () =>
      latestSub && (latestSub.status === 'revision' || latestSub.status === 'rejected'),
    [latestSub]
  );

  const canSubmitNew = useMemo(
    () =>
      !activeSubmission && eligibility.isEligible && (periodDisplay.isOpen || hasExemption),
    [activeSubmission, eligibility.isEligible, periodDisplay.isOpen, hasExemption]
  );

  if (loading) return <LoadingScreen message="Memuat dashboard..." />;

  return (
    <View style={styles.flex}>
      {/* Formal Academic Header: Nama, NIM, Nama Lengkap Program Studi, Total SKS */}
      <HomeHeader
        userName={user?.name}
        userNim={user?.nim_or_nip}
        userDepartmentName={departmentFullName}
        userSks={eligibility.studentSks}
        avatarUrl={user?.avatar_url}
        onProfilePress={() => router.push('/profile')}
        onSignOutPress={handleSignOut}
        collapsed={headerCollapsed}
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          setHeaderCollapsed((prev) => (y > 40 ? true : y < 10 ? false : prev));
        }}
        refreshControl={undefined}
      >
        {/* TOP INFO CARD: Dynamic period status — component handles open/upcoming/closed */}
        <PeriodInfoCard periodDisplay={periodDisplay} />

        {/* Carousel info — auto-scroll slide terintegrasi periodWatcher */}
        <Carousel period={periodDisplay} height={108} autoPlayMs={4000} />

        {/* Grid Navigation */}
        <GridNav />

        {/* 1. HERO ACTION / INELIGIBLE WARNING / DISABLED SECTION / ACTIVE TRACKING */}
        {activeSubmission ? (
          /* Case A: Live Status Card for Active Submission */
          <TouchableOpacity
            onPress={() => router.push(`/submission/${activeSubmission.$id}` as any)}
            activeOpacity={0.7}
          >
            <Section style={styles.headerCard}>
              <View style={styles.headerTopRow}>
                <View style={styles.headerLeftCol}>
                  <View style={styles.headerIconBox}>
                    <GraduationCap size={20} color={Colors.primary} strokeWidth={2.2} />
                  </View>
                  <View style={styles.headerTexts}>
                    <Text style={styles.headerTitle} numberOfLines={1}>Pengajuan Skripsi</Text>
                    <Text style={styles.headerId} numberOfLines={1} ellipsizeMode="middle">
                      NO. DOKUMEN:{' '}
                      {activeSubmission.surat?.no_dokumen ||
                        activeSubmission.surat?.noDokumen ||
                        `SPSM_${activeSubmission.$id.toUpperCase().slice(0, 12)}`}
                    </Text>
                    {activeSubmission.nomor_surat && (
                      <Text style={styles.headerSkId} numberOfLines={1} ellipsizeMode="middle">
                        NO. SK: {activeSubmission.nomor_surat}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Status Badge - Absolute Position */}
              <View style={styles.headerBadgeAbsolute}>
                <StatusBadge status={activeSubmission.status} size="sm" />
              </View>

              <View style={styles.headerDivider} />

              <View style={styles.headerMetaRow}>
                <View style={styles.headerMetaItem}>
                  <View style={styles.dateContainer}>
                    <View style={styles.dateItem}>
                      <Text style={styles.headerMetaLabel}>Tanggal Pengajuan</Text>
                      <Text style={styles.headerMetaValue}>
                        {new Date(activeSubmission.submitted_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    {activeSubmission.kaprodiApprovalDate && (
                      <View style={styles.dateItem}>
                        <Text style={styles.headerMetaLabel}>Tanggal Disahkan</Text>
                        <Text style={styles.headerMetaValue}>
                          {new Date(activeSubmission.kaprodiApprovalDate).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.headerMetaItem}>
                  <Text style={styles.headerMetaLabel}>Status</Text>
                  <Text style={styles.headerMetaValueHL}>
                    {activeSubmission.status === 'sk_issued' ||
                    activeSubmission.status === 'approved'
                      ? 'SK Resmi Terbit'
                      : activeSubmission.status === 'sk_process'
                      ? 'Proses TTD Dekan'
                      : activeSubmission.status === 'waiting_akademik'
                      ? 'Menunggu Administrasi TU'
                      : activeSubmission.status === 'waiting_kaprodi'
                      ? 'Pleno Kaprodi'
                      : activeSubmission.status === 'revision'
                      ? 'Perlu Revisi'
                      : activeSubmission.status === 'rejected'
                      ? 'Ditolak'
                      : activeSubmission.status === 'drafting'
                      ? 'Draf'
                      : 'Menunggu Review'}
                  </Text>
                </View>
              </View>

            </Section>
          </TouchableOpacity>
        ) : !eligibility.isEligible ? (
          /* Case B: Ineligible Warning — component handles course checklist & lock button */
          <EligibilityCard eligibility={eligibility} />
        ) : !periodDisplay.isOpen && !hasExemption ? (
          /* Case C: Period Closed — component shows disabled submission area */
          <ClosedPeriodCard periodDisplay={periodDisplay} />
        ) : (
          /* Case D: Eligible and Period Open (or has exemption) */
          <HeroSubmitCard
            onPress={() => router.push('/submission/create' as any)}
            titleCount={settings?.required_title_count ?? 3}
          />
        )}

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
            subtitle={
              canSubmitNew
                ? `Anda belum memiliki riwayat pengajuan judul. Klik tombol di atas untuk mengajukan ${settings?.required_title_count ?? 3} usulan judul skripsi.`
                : 'Belum ada riwayat pengajuan judul skripsi pada akun Anda.'
            }
            icon={<FileText size={32} color={Colors.primary} strokeWidth={2} />}
            action={
              canSubmitNew ? (
                <Button
                  title="Mulai Pengajuan Baru"
                  onPress={() => router.push('/submission/create' as any)}
                  variant="primary"
                  size="sm"
                  style={{ marginTop: 8 }}
                />
              ) : undefined
            }
          />
        ) : (
          submissions.map((sub, index) => (
            <DashboardSubmissionCard
              key={sub.$id}
              sub={sub}
              number={submissions.length - index}
              expanded={Boolean(expandedCards[sub.$id])}
              resubmitDisabled={Boolean(activeSubmission)}
              onToggleExpand={toggleCardExpansion}
            />
          ))
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
    padding: 0,
  },
  heroCardContent: {
    padding: 20,
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
    padding: 0,
  },
  activeCardContent: {
    padding: 20,
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

  // Header Card (from detail page)
  headerCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeftCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTexts: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: Colors.text,
  },
  headerId: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  headerSkId: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#059669',
    fontWeight: '700',
    marginTop: 2,
  },
  headerBadgeWrap: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  headerBadgeAbsolute: {
    position: 'absolute',
    top: -10,
    right: 10,
    zIndex: 10,
  },
  headerDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  headerMetaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  headerMetaItem: {
    flex: 1,
  },
  dateContainer: {
    gap: 8,
  },
  dateItem: {
    gap: 2,
  },
  headerMetaLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  headerMetaValue: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600',
    marginTop: 2,
  },
  headerMetaValueSub: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
    marginTop: 4,
  },
  headerMetaValueHL: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },

  // Info Section Styles (label-value format)
  infoSection: {
    marginBottom: 12,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
    minWidth: 80,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    textAlign: 'right',
  },
  infoValueMono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  infoValueSuccess: {
    color: '#059669',
  },

  // Title Section Styles
  titleSection: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  titleValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 20,
  },

  // Advisor Section Styles
  advisorSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  advisorInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  advisorBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  advisorBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  advisorDetails: {
    flex: 1,
  },
  advisorName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  advisorNip: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 1,
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

  // Submissions list card
  submissionCard: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  cardBadgeAbsolute: {
    position: 'absolute',
    top: -10,
    right: 10,
    zIndex: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardHeaderTouchable: {
    marginBottom: 8,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  expandLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    flex: 1,
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

  resubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  resubmitButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  resubmitButtonText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Revision/Rejection Option Styles
  revisionOptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  revisionBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 1,
  },
  revisionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  revisionContent: {
    flex: 1,
  },
  revisionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 18,
    marginBottom: 4,
  },
  revisionNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  revisionNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
  },

  // List Card Multi Box Styles
  listCardMultiBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  listCardMultiLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  listCardOptRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  listCardOptBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 1,
  },
  listCardOptBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  listCardOptText: {
    flex: 1,
    fontSize: 12,
    color: Colors.text,
    lineHeight: 16,
  },
  listCardSkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  listCardSkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  // 3 Titles in Active Dashboard Card
  dashboardThreeTitlesBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    gap: 8,
  },
  dashboardThreeTitlesLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dashboardOptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  dashboardOptionBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 1,
  },
  dashboardOptionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  dashboardOptionText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 17,
  },
  activeSkNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 10,
  },
  activeSkNumberText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#065F46',
  },

});
