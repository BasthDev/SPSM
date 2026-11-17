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
  Clock,
  FilePen,
  Lock,
  Trash2,
  XCircle,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
// 4. DraftNoticeCard — Shown when user has an active local draft
// ─────────────────────────────────────────────────────────────
interface DraftNoticeCardProps {
  onContinue: () => void;
  onDelete: () => void;
  savedAt?: string;
}

export function DraftNoticeCard({ onContinue, onDelete, savedAt }: DraftNoticeCardProps) {
  const dateFormatted = savedAt
    ? new Date(savedAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const confirmDelete = () => {
    Alert.alert(
      'Hapus Draf Pengajuan',
      'Apakah Anda yakin ingin menghapus draf ini? Pengajuan baru akan kembali dibuka.',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Ya, Hapus', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  return (
    <View style={styles.whiteCardWrap}>
      <View style={styles.whiteCard}>
        {/* Top Header / Content */}
        <TouchableOpacity onPress={onContinue} activeOpacity={0.85}>
          <View style={styles.headerContainer}>
            <View style={styles.draftIconCircleWhite}>
              <FilePen size={22} color={Colors.primary} strokeWidth={2.3} />
            </View>
            <View style={styles.textContainer}>
              <View style={styles.titleRow}>
                <Text style={styles.draftTitleWhite} numberOfLines={1}>
                  Draf Pengajuan Tersimpan
                </Text>
                <View style={styles.draftBadgeWhite}>
                  <Text style={styles.draftBadgeTextWhite}>DRAF AKTIF</Text>
                </View>
              </View>
              <Text style={styles.draftDescWhite} numberOfLines={2}>
                Anda memiliki draf pengajuan judul yang belum dikirim. Selesaikan draf atau hapus untuk membuka pengajuan baru.
              </Text>
              {dateFormatted ? (
                <View style={styles.draftMetaRow}>
                  <Clock size={12} color="#64748B" strokeWidth={2} />
                  <Text style={styles.draftMetaText}>
                    Disimpan {dateFormatted} • Berlaku 1 bulan
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.chevronBox}>
              <ChevronRight size={20} color={Colors.textTertiary} strokeWidth={2.4} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Action Row */}
        <View style={styles.draftWhiteActionRow}>
          <TouchableOpacity
            onPress={onContinue}
            activeOpacity={0.8}
            style={styles.draftWhiteContinueBtn}
          >
            <Text style={styles.draftWhiteContinueBtnText}>Lanjutkan Pengisian Draf</Text>
            <ChevronRight size={15} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={confirmDelete}
            activeOpacity={0.8}
            style={styles.draftWhiteDeleteBtn}
          >
            <Trash2 size={14} color="#DC2626" strokeWidth={2.2} />
            <Text style={styles.draftWhiteDeleteBtnText}>Hapus</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
  whiteCardWrap: {
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
      web: { boxShadow: '0 4px 14px rgba(0, 0, 0, 0.05)' },
    }),
  },
  whiteCard: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
  },
  draftIconCircleWhite: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  draftTitleWhite: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  draftBadgeWhite: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  draftBadgeTextWhite: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.4,
  },
  draftDescWhite: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 17,
    fontWeight: '500',
    marginTop: 2,
  },
  draftMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  draftMetaText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  draftWhiteActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  draftWhiteContinueBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  draftWhiteContinueBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  draftWhiteDeleteBtn: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  draftWhiteDeleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
});