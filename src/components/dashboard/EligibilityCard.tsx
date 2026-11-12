/**
 * EligibilityCard
 *
 * Solid card component for displaying academic prerequisite evaluation results.
 * Pure solid white background, high contrast borders, solid badges, and crisp indicators.
 *
 * Automatically skips prerequisite course checks if no courses are required by admin.
 */
import { type EligibilityResult, type PeriodDisplayStatus } from '@/services/settingsService';
import { Colors } from '@/theme/theme';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Lock,
  PlusCircle,
  ShieldAlert,
  XCircle,
} from 'lucide-react-native';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// ─────────────────────────────────────────────────────────────
// 1. EligibilityCard — Shown when student is INELIGIBLE
// ─────────────────────────────────────────────────────────────
interface EligibilityCardProps {
  eligibility: EligibilityResult;
}

export function EligibilityCard({ eligibility }: EligibilityCardProps) {
  const hasRequiredCourses =
    Array.isArray(eligibility.requiredCourses) && eligibility.requiredCourses.length > 0;

  return (
    <View style={styles.solidIneligibleCard}>
      <View style={styles.cardPadding}>
        {/* Header Row: Shield Icon + Solid Pill + Title */}
        <View style={styles.headerRow}>
          <View style={styles.shieldIconBox}>
            <ShieldAlert size={22} color="#DC2626" strokeWidth={2.4} />
          </View>
          <View style={styles.headerTextCol}>
            <View style={styles.solidDangerBadge}>
              <Text style={styles.solidDangerBadgeText}>PRASYARAT AKADEMIK</Text>
            </View>
            <Text style={styles.cardHeading}>Anda Belum Memenuhi Syarat</Text>
            <Text style={styles.cardSubtitle}>
              Sistem mendeteksi kriteria minimal pendaftaran judul skripsi belum terpenuhi:
            </Text>
          </View>
        </View>

        {/* Checklist Box — Solid background, crisp borders */}
        <View style={styles.checklistBox}>
          {/* SKS Check */}
          <View style={styles.checkItemRow}>
            {eligibility.sksSatisfied ? (
              <CheckCircle2 size={18} color="#059669" strokeWidth={2.4} />
            ) : (
              <XCircle size={18} color="#DC2626" strokeWidth={2.4} />
            )}
            <View style={styles.checkItemTextCol}>
              <Text style={styles.checkItemTitle}>
                Total SKS Kumulatif ({eligibility.studentSks} / minimal {eligibility.minSks} SKS)
              </Text>
              <Text style={eligibility.sksSatisfied ? styles.successText : styles.dangerText}>
                {eligibility.sksSatisfied
                  ? '✓ Terpenuhi (Syarat perolehan SKS mencukupi)'
                  : `✗ Belum Terpenuhi (Kurang ${Math.max(
                      0,
                      eligibility.minSks - eligibility.studentSks
                    )} SKS untuk mengajukan skripsi)`}
              </Text>
            </View>
          </View>

          {/* Prerequisite Courses — Only render when admin sets required courses! */}
          {hasRequiredCourses && (
            <>
              <View style={styles.checklistDivider}>
                <Text style={styles.checklistDividerLabel}>
                  Status Kelulusan Mata Kuliah Prasyarat Wajib:
                </Text>
              </View>

              {eligibility.requiredCourses.map((reqCourse, idx) => {
                const isPassed = eligibility.completedCourses.some(
                  (c) => c.trim().toLowerCase() === reqCourse.trim().toLowerCase()
                );
                return (
                  <View key={idx} style={styles.checkItemRow}>
                    {isPassed ? (
                      <CheckCircle2 size={18} color="#059669" strokeWidth={2.4} />
                    ) : (
                      <XCircle size={18} color="#DC2626" strokeWidth={2.4} />
                    )}
                    <View style={styles.checkItemTextCol}>
                      <Text style={styles.checkItemTitle}>{reqCourse}</Text>
                      <Text style={isPassed ? styles.successText : styles.dangerText}>
                        {isPassed
                          ? '✓ Terpenuhi (Lulus)'
                          : '✗ Belum Terpenuhi (Mata kuliah belum diselesaikan)'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {/* Informational GPA if present */}
          {typeof eligibility.gpa === 'number' && (
            <View style={styles.checkItemRow}>
              <BookOpen size={18} color={Colors.primary} strokeWidth={2.2} />
              <View style={styles.checkItemTextCol}>
                <Text style={styles.checkItemTitle}>Indeks Prestasi Kumulatif (IPK)</Text>
                <Text style={styles.infoText}>IPK Tercatat: {eligibility.gpa.toFixed(2)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Lock Action & Advisory Note */}
        <View style={styles.actionSection}>
          <TouchableOpacity disabled activeOpacity={1} style={styles.solidLockedButton}>
            <Lock size={15} color="#64748B" strokeWidth={2.4} />
            <Text style={styles.solidLockedButtonText}>
              Pengajuan Terkunci (Belum Memenuhi Syarat)
            </Text>
          </TouchableOpacity>
          <Text style={styles.advisoryNote}>
            Silakan hubungi Bagian Tata Usaha atau Ketua Program Studi jika terdapat pembaharuan
            data akademik Anda.
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. ClosedPeriodCard — Shown when student is eligible but period is closed
// ─────────────────────────────────────────────────────────────
interface ClosedPeriodCardProps {
  periodDisplay: PeriodDisplayStatus;
}

export function ClosedPeriodCard({ periodDisplay }: ClosedPeriodCardProps) {
  return (
    <View style={styles.solidClosedCard}>
      <View style={styles.cardPadding}>
        <View style={styles.headerRow}>
          <View style={styles.lockIconBox}>
            <Lock size={22} color="#64748B" strokeWidth={2.4} />
          </View>
          <View style={styles.headerTextCol}>
            <View style={styles.solidMutedBadge}>
              <Text style={styles.solidMutedBadgeText}>PENDAFTARAN DITUTUP</Text>
            </View>
            <Text style={styles.cardHeadingMuted}>Ajukan Judul Skripsi</Text>
            <Text style={styles.cardSubtitle}>
              {periodDisplay.description ||
                'Pendaftaran judul skripsi saat ini sedang ditutup sesuai jadwal kalender akademik.'}
            </Text>
          </View>
        </View>

        <View style={styles.closedDivider} />

        <TouchableOpacity disabled activeOpacity={1} style={styles.solidLockedButton}>
          <Lock size={15} color="#64748B" strokeWidth={2.4} />
          <Text style={styles.solidLockedButtonText}>
            Tombol Pengajuan Sedang Dinonaktifkan
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. HeroSubmitCard — Shown when eligible AND period is open
// ─────────────────────────────────────────────────────────────
interface HeroSubmitCardProps {
  onPress: () => void;
  titleCount?: number;
}

export function HeroSubmitCard({ onPress, titleCount = 3 }: HeroSubmitCardProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={styles.solidHeroCard}>
        <View style={styles.cardPadding}>
          <View style={styles.heroRow}>
            <View style={styles.plusIconBox}>
              <PlusCircle size={26} color={Colors.primary} strokeWidth={2.4} />
            </View>
            <View style={styles.heroTextCol}>
              <Text style={styles.heroTitle}>Ajukan Judul Skripsi</Text>
              <Text style={styles.heroSubtitle}>
                Kirimkan {titleCount} opsi judul skripsi untuk direview oleh Dosen Penilai &amp; Kaprodi
              </Text>
            </View>
            <View style={styles.heroChevronBox}>
              <ChevronRight size={20} color={Colors.primary} strokeWidth={2.5} />
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles — 100% Solid Cards, No Transparent/Translucent Layouts
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // --- Ineligible Card ---
  solidIneligibleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4.5,
    borderLeftColor: '#DC2626',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  cardPadding: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  shieldIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  headerTextCol: {
    flex: 1,
  },
  solidDangerBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  solidDangerBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  cardHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  cardHeadingMuted: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },

  // --- Checklist ---
  checklistBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkItemTextCol: {
    flex: 1,
  },
  checkItemTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  successText: {
    fontSize: 11.5,
    color: '#059669',
    fontWeight: '600',
  },
  dangerText: {
    fontSize: 11.5,
    color: '#DC2626',
    fontWeight: '600',
  },
  infoText: {
    fontSize: 11.5,
    color: Colors.primary,
    fontWeight: '600',
  },
  checklistDivider: {
    paddingTop: 8,
    paddingBottom: 2,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  checklistDividerLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // --- Actions ---
  actionSection: {
    gap: 8,
  },
  solidLockedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  solidLockedButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  advisoryNote: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },

  // --- Closed Period Card ---
  solidClosedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4.5,
    borderLeftColor: '#64748B',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  lockIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  solidMutedBadge: {
    backgroundColor: '#64748B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  solidMutedBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  closedDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
  },

  // --- Hero Submit Card ---
  solidHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderLeftWidth: 4.5,
    borderLeftColor: Colors.primary,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 3px 12px rgba(10, 76, 143, 0.08)',
      },
    }),
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  plusIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextCol: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  heroChevronBox: {
    paddingLeft: 4,
  },
});
