/**
 * EligibilityCard
 *
 * Solid card component for displaying academic prerequisite evaluation results.
 * Clean, minimal layout with no large floating icons.
 */
import { type EligibilityResult, type PeriodDisplayStatus } from '@/services/settingsService';
import { Colors } from '@/theme/theme';
import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Lock,
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
  const [expanded, setExpanded] = useState(true);
  const hasRequiredCourses =
    Array.isArray(eligibility.requiredCourses) && eligibility.requiredCourses.length > 0;

  return (
    <View style={styles.solidIneligibleCard}>
      <View style={styles.cardPadding}>
        {/* Header Row — tappable to expand/collapse */}
        <TouchableOpacity
          style={styles.headerContainer}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={styles.headerTopRow}>
            <View style={styles.solidDangerBadge}>
              <Text style={styles.solidDangerBadgeText}>PRASYARAT AKADEMIK</Text>
            </View>
            {expanded ? (
              <ChevronUp size={18} color={Colors.textTertiary} strokeWidth={2.2} />
            ) : (
              <ChevronDown size={18} color={Colors.textTertiary} strokeWidth={2.2} />
            )}
          </View>
          <Text style={styles.cardHeading}>Belum Memenuhi Syarat</Text>
          <Text style={styles.cardSubtitle}>
            Kriteria minimal pengajuan skripsi belum terpenuhi.
            {!expanded ? ' Ketuk untuk melihat detail.' : ''}
          </Text>
        </TouchableOpacity>

        {/* Minimalist Checklist Box */}
        {expanded && (
        <View style={styles.checklistBox}>
          
          {/* SKS Check */}
          <View style={styles.checkRow}>
            <Text style={styles.checkLabel}>Total SKS</Text>
            <View style={styles.checkValueBox}>
              <Text style={[styles.checkValueText, eligibility.sksSatisfied ? styles.textSuccess : styles.textDanger]}>
                {eligibility.studentSks} / {eligibility.minSks}
              </Text>
              {eligibility.sksSatisfied ? (
                <CheckCircle2 size={18} color="#059669" strokeWidth={2.5} />
              ) : (
                <XCircle size={18} color="#DC2626" strokeWidth={2.5} />
              )}
            </View>
          </View>

          {/* Informational GPA if present */}
          {typeof eligibility.gpa === 'number' && (
            <View style={styles.checkRow}>
              <Text style={styles.checkLabel}>IPK</Text>
              <Text style={styles.checkValueText}>{eligibility.gpa.toFixed(2)}</Text>
            </View>
          )}

          {/* Prerequisite Courses */}
          {hasRequiredCourses && (
            <>
              <View style={styles.divider} />
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
                      <CheckCircle2 size={18} color="#059669" strokeWidth={2.5} />
                    ) : (
                      <XCircle size={18} color="#DC2626" strokeWidth={2.5} />
                    )}
                  </View>
                );
              })}
            </>
          )}
        </View>
        )}

        {/* Lock Action */}
        <TouchableOpacity disabled activeOpacity={1} style={styles.solidLockedButton}>
          <Lock size={15} color="#64748B" strokeWidth={2.4} />
          <Text style={styles.solidLockedButtonText}>
            Pengajuan Terkunci
          </Text>
        </TouchableOpacity>
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
        <View style={styles.headerContainer}>
          <View style={styles.solidMutedBadge}>
            <Text style={styles.solidMutedBadgeText}>PENDAFTARAN DITUTUP</Text>
          </View>
          <Text style={styles.cardHeadingMuted}>Ajukan Judul Skripsi</Text>
          <Text style={styles.cardSubtitle}>
            {periodDisplay.description || 'Pendaftaran judul saat ini sedang ditutup.'}
          </Text>
        </View>

        <TouchableOpacity disabled activeOpacity={1} style={styles.solidLockedButton}>
          <Lock size={15} color="#64748B" strokeWidth={2.4} />
          <Text style={styles.solidLockedButtonText}>
            Tombol Pengajuan Dinonaktifkan
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
            <View style={styles.heroTextCol}>
              <Text style={styles.heroTitle}>Ajukan Judul Skripsi</Text>
              <Text style={styles.heroSubtitle}>
                Kirimkan {titleCount} opsi judul untuk direview oleh Dosen & Kaprodi
              </Text>
            </View>
            <ChevronRight size={22} color={Colors.primary} strokeWidth={2.5} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
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
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' },
    }),
  },
  cardPadding: {
    padding: 16,
  },
  headerContainer: {
    marginBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  solidDangerBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  solidDangerBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  cardHeadingMuted: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },

  // --- Checklist List (Minimalist) ---
  checklistBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    marginBottom: 16,
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

  // --- Buttons / Actions ---
  solidLockedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  solidLockedButtonText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
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
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' },
    }),
  },
  solidMutedBadge: {
    backgroundColor: '#64748B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  solidMutedBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
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
      ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
      web: { boxShadow: '0 3px 12px rgba(10, 76, 143, 0.08)' },
    }),
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
});