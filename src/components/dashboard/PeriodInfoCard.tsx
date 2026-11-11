/**
 * PeriodInfoCard
 *
 * Solid card displaying thesis submission period status at the top of the dashboard.
 * Pure solid white surface, solid accent indicators, solid badges, and crisp contrast.
 */
import { type PeriodDisplayStatus } from '@/services/settingsService';
import { Colors } from '@/theme/theme';
import { AlertTriangle, Calendar, Clock } from 'lucide-react-native';
import { Platform, StyleSheet, Text, View } from 'react-native';

interface Props {
  periodDisplay: PeriodDisplayStatus;
}

export function PeriodInfoCard({ periodDisplay }: Props) {
  const getTheme = (status: PeriodDisplayStatus['status']) => {
    switch (status) {
      case 'open':
        return {
          MainIcon: Calendar,
          ScheduleIcon: Clock,
          accentColor: '#059669',
          iconBg: '#ECFDF5',
          iconBorder: '#A7F3D0',
          badgeBg: '#059669',
          badgeText: '#FFFFFF',
          badgeLabel: 'PENDAFTARAN DIBUKA',
          schedulePrefix: 'Jadwal:',
        };
      case 'upcoming':
        return {
          MainIcon: Clock,
          ScheduleIcon: Calendar,
          accentColor: Colors.primary,
          iconBg: Colors.primaryMuted,
          iconBorder: '#BAE6FD',
          badgeBg: Colors.primary,
          badgeText: '#FFFFFF',
          badgeLabel: 'AKAN DATANG',
          schedulePrefix: 'Dibuka pada:',
        };
      case 'closed':
      default:
        return {
          MainIcon: AlertTriangle,
          ScheduleIcon: Calendar,
          accentColor: '#D97706',
          iconBg: '#FFFBEB',
          iconBorder: '#FDE68A',
          badgeBg: '#D97706',
          badgeText: '#FFFFFF',
          badgeLabel: 'PENDAFTARAN DITUTUP',
          schedulePrefix: 'Periode:',
        };
    }
  };

  const theme = getTheme(periodDisplay.status);
  const { MainIcon, ScheduleIcon } = theme;

  return (
    <View style={[styles.solidCard, { borderLeftColor: theme.accentColor }]}>
      <View style={styles.cardInner}>
        {/* Left Icon with solid contrast circle */}
        <View
          style={[
            styles.iconBox,
            { backgroundColor: theme.iconBg, borderColor: theme.iconBorder },
          ]}
        >
          <MainIcon size={22} color={theme.accentColor} strokeWidth={2.4} />
        </View>

        {/* Content Column */}
        <View style={styles.contentCol}>
          {/* Header Row: Solid Pill Badge + Academic Year */}
          <View style={styles.topMetaRow}>
            <View style={[styles.solidBadge, { backgroundColor: theme.badgeBg }]}>
              <Text style={[styles.solidBadgeText, { color: theme.badgeText }]}>
                {theme.badgeLabel}
              </Text>
            </View>
            <Text style={styles.academicYearText}>{periodDisplay.academicYear}</Text>
          </View>

          {/* Main Title & Description */}
          <Text style={styles.cardTitle}>{periodDisplay.title}</Text>
          <Text style={styles.cardDesc}>{periodDisplay.description}</Text>

          {/* Schedule Footer Row */}
          <View style={styles.scheduleRow}>
            <ScheduleIcon size={13} color={theme.accentColor} strokeWidth={2.4} />
            <Text style={styles.scheduleLabel}>
              {theme.schedulePrefix}{' '}
              <Text style={[styles.scheduleValue, { color: theme.accentColor }]}>
                {periodDisplay.dateRangeText}
              </Text>
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  solidCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4.5,
    marginBottom: 16,
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
  cardInner: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  contentCol: {
    flex: 1,
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  solidBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  solidBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  academicYearText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  scheduleLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  scheduleValue: {
    fontWeight: '700',
  },
});
