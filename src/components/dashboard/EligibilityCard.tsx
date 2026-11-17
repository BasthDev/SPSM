import { type EligibilityResult, type PeriodDisplayStatus } from '@/services/settingsService';
import { Colors } from '@/theme/theme'; /**
 * EligibilityCard
 *
 * Premium gradient card component for displaying academic prerequisite evaluation results.
 * Using warm orange gradient for eligibility warnings and matching the Carousel design system.
 */
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertTriangle,
  CalendarX2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FilePen,
  Lock,
  XCircle,
} from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// ─────────────────────────────────────────────────────────────
// 1. EligibilityCard — Shown when student is INELIGIBLE (Orange Theme)
// ─────────────────────────────────────────────────────────────
interface EligibilityCardProps {
  eligibility: EligibilityResult;
}

export function EligibilityCard({ eligibility }: EligibilityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasRequiredCourses =
    Array.isArray(eligibility.requiredCourses) && eligibility.requiredCourses.length > 0;

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['#D97706', '#B45309']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Header Row — Tappable to expand/collapse details */}
        <TouchableOpacity
          style={styles.headerContainer}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={styles.iconCircle}>
            <AlertTriangle size={22} color="#FFFFFF" strokeWidth={2.3} />
          </View>
          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                Belum Memenuhi Syarat
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>TERKUNCI</Text>
              </View>
            </View>
            <Text style={styles.desc} numberOfLines={expanded ? undefined : 2}>
              Kriteria minimal pengajuan skripsi belum terpenuhi.{!expanded ? ' Ketuk untuk detail.' : ''}
            </Text>
          </View>
          <View style={styles.chevronBox}>
            {expanded ? (
              <ChevronUp size={18} color="#FFFFFF" strokeWidth={2.5} />
            ) : (
              <ChevronDown size={18} color="#FFFFFF" strokeWidth={2.5} />
            )}
          </View>
        </TouchableOpacity>

        {/* Expanded Minimalist Checklist Box */}
        {expanded && (
          <View style={styles.checklistBox}>
            {/* SKS Check */}
            <View style={styles.checkRow}>
              <Text style={styles.checkLabel}>Total SKS</Text>
              <View style={styles.checkValueBox}>
                <Text
                  style={[
                    styles.checkValueText,
                    eligibility.sksSatisfied ? styles.textSuccess : styles.textDanger,
                  ]}
                >
                  {eligibility.studentSks} / {eligibility.minSks}
                </Text>
                {eligibility.sksSatisfied ? (
                  <CheckCircle2 size={16} color="#059669" strokeWidth={2.5} />
                ) : (
                  <XCircle size={16} color="#DC2626" strokeWidth={2.5} />
                )}
              </View>
            </View>

            {/* GPA Check */}
            {typeof eligibility.gpa === 'number' && (
              <View style={styles.checkRow}>
                <Text style={styles.checkLabel}>IPK Minimal</Text>
                <Text style={[styles.checkValueText, { color: '#0F172A' }]}>
                  {eligibility.gpa.toFixed(2)}
                </Text>
              </View>
            )}

            {/* Prerequisite Courses */}
            {hasRequiredCourses && (
              <>
                <View style={styles.divider} />
                <Text style={styles.sectionInnerTitle}>Mata Kuliah Prasyarat</Text>
                {eligibility.requiredCourses.map((reqCourse, idx) => {
                  const isPassed = eligibility.completedCourses.some(
                    (c) => c.trim().toLowerCase() === reqCourse.trim().toLowerCase()
                  );
                  return (
                    <View key={idx} style={styles.checkRow}>
                      <Text style={[styles.checkLabel, { flex: 1 }]} numberOfLines={1}>
                        {reqCourse}
                      </Text>
                      {isPassed ? (
                        <CheckCircle2 size={16} color="#059669" strokeWidth={2.5} />
                      ) : (
                        <XCircle size={16} color="#DC2626" strokeWidth={2.5} />
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}

        {/* Lock Footer Action */}
        <View style={styles.cardFooterAction}>
          <Lock size={14} color="rgba(255, 255, 255, 0.8)" strokeWidth={2.4} />
          <Text style={styles.cardFooterText}>Pengajuan skripsi ditahan hingga prasyarat terpenuhi</Text>
        </View>
      </LinearGradient>
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
    <View style={styles.wrap}>
      <LinearGradient
        colors={['#475569', '#334155']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.headerContainer}>
          <View style={styles.iconCircle}>
            <CalendarX2 size={22} color="#FFFFFF" strokeWidth={2.3} />
          </View>
          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                Pendaftaran Ditutup
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>DITUTUP</Text>
              </View>
            </View>
            <Text style={styles.desc} numberOfLines={2}>
              {periodDisplay.description || 'Masa pengajuan judul skripsi saat ini sedang ditutup.'}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooterAction}>
          <Lock size={14} color="rgba(255, 255, 255, 0.8)" strokeWidth={2.4} />
          <Text style={styles.cardFooterText}>Tombol pengajuan dinonaktifkan sementara</Text>
        </View>
      </LinearGradient>
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
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.wrap}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.headerContainer}>
          <View style={styles.iconCircle}>
            <FilePen size={22} color="#FFFFFF" strokeWidth={2.3} />
          </View>
          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                Ajukan Judul Skripsi
              </Text>
              <View style={[styles.badge, { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]}>
                <Text style={styles.badgeText}>DIBUKA</Text>
              </View>
            </View>
            <Text style={styles.desc} numberOfLines={2}>
              Kirimkan {titleCount} opsi judul terbaik untuk direview oleh Dosen & Kaprodi.
            </Text>
          </View>
          <View style={styles.chevronBox}>
            <ChevronRight size={20} color="#FFFFFF" strokeWidth={2.8} />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles (Consistent with Carousel Design System)
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)' },
    }),
  },
  card: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  title: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  desc: {
    fontSize: 12.5,
    color: '#F1F5F9',
    lineHeight: 17,
    fontWeight: '500',
  },
  chevronBox: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  
  // --- Expanded Checklist Box inside Ineligible Card ---
  checklistBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  checkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  checkLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  checkValueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkValueText: {
    fontSize: 13,
    fontWeight: '700',
  },
  textSuccess: { color: '#059669' },
  textDanger: { color: '#DC2626' },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  sectionInnerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // --- Footer Notice on Gradient Cards ---
  cardFooterAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 15%)',
  },
  cardFooterText: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
});