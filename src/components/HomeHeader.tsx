import { Colors } from '@/theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Bell, GraduationCap, LogOut, User } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';

interface HomeHeaderProps {
  userName?: string;
  userNim?: string;
  userDepartmentName?: string;
  userSubtitle?: string;
  userSks?: number;
  avatarUrl?: string | null;
  onProfilePress?: () => void;
  onSignOutPress?: () => void;
  onNotificationPress?: () => void;
  hasUnreadNotification?: boolean;
  /** true saat halaman di-scroll ke bawah — header menyusut jadi compact */
  collapsed?: boolean;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  userName,
  userNim,
  userDepartmentName,
  userSubtitle,
  userSks,
  avatarUrl,
  onProfilePress,
  onSignOutPress,
  onNotificationPress,
  hasUnreadNotification = false,
  collapsed = false,
}) => {
  const insets = useSafeAreaInsets();
  const displayName = userName && userName.trim().length > 0 ? userName : 'Mahasiswa';

  // 0 = expanded, 1 = collapsed
  const progress = useSharedValue(collapsed ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(collapsed ? 1 : 0, {
      duration: 260,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [collapsed, progress]);

  // Animasi untuk Brand Bar (Anti-flicker dengan height tetap & scaleY)
  const brandStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [1, 0]);
    return {
      opacity: interpolate(progress.value, [0, 0.3], [1, 0]),
      transform: [{ scaleY: scale }, { translateY: interpolate(progress.value, [0, 1], [0, -10]) }],
      height: interpolate(progress.value, [0, 1], [32, 0]),
      marginBottom: interpolate(progress.value, [0, 1], [12, 0]),
      overflow: 'hidden' as const,
      transformOrigin: 'top' as const,
    };
  });

  // Animasi untuk Expanded Section (profil lengkap)
  const expandedStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [1, 0.95]);
    return {
      opacity: interpolate(progress.value, [0, 0.25], [1, 0]),
      transform: [{ scaleY: scale }],
      height: interpolate(progress.value, [0, 1], [72, 0]),
      overflow: 'hidden' as const,
      pointerEvents: progress.value > 0.5 ? ('none' as const) : ('auto' as const),
      transformOrigin: 'top' as const,
    };
  });

  // Animasi untuk Compact Section (muncul mulus saat collapsed)
  const compactStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(progress.value, [0.7, 1], [0, 1]),
      transform: [{ translateY: interpolate(progress.value, [0, 1], [10, 0]) }],
      height: interpolate(progress.value, [0, 1], [0, 44]),
      overflow: 'hidden' as const,
      pointerEvents: progress.value < 0.5 ? ('none' as const) : ('auto' as const),
    };
  });

  return (
    <LinearGradient
      colors={[Colors.primary, Colors.primaryLight]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.gradientContainer,
        collapsed && styles.gradientContainerCollapsed,
        { paddingTop: insets.top + (collapsed ? 6 : 10) },
      ]}
    >
      <StatusBar style="light" />

      {/* Top Brand Bar */}
      <Animated.View style={brandStyle}>
        <View style={styles.brandBar}>
          <View style={styles.brandLeft}>
            <GraduationCap size={18} color="#BAE6FD" strokeWidth={2.2} />
            <Text style={styles.brandText}>SPSM Portal</Text>
          </View>
          {typeof userSks === 'number' && (
            <View style={styles.sksBadge}>
              <Text style={styles.sksBadgeText}>{userSks} SKS</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Expanded row — profil lengkap */}
      <Animated.View style={[styles.contentRow, expandedStyle]}>
        <TouchableOpacity
          style={styles.profileSection}
          onPress={onProfilePress}
          activeOpacity={0.85}
        >
          <View style={styles.avatarBorder}>
            <Avatar name={displayName} source={avatarUrl} size={48} backgroundColor="#1E3A5F" iconFallback />
          </View>

          <View style={styles.userTextCol}>
            <Text style={styles.userNameText} numberOfLines={1}>
              {displayName}
            </Text>
            {userNim ? (
              <Text style={styles.userNimText} numberOfLines={1}>
                NIM: {userNim}
              </Text>
            ) : null}
            {userDepartmentName ? (
              <Text style={styles.userDeptText} numberOfLines={1}>
                {userDepartmentName}
              </Text>
            ) : userSubtitle ? (
              <Text style={styles.userDeptText} numberOfLines={1}>
                {userSubtitle}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        <View style={styles.rightActionsRow}>
          {onNotificationPress ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onNotificationPress}
              activeOpacity={0.75}
            >
              <Bell size={18} color="#FFFFFF" strokeWidth={2} />
              {hasUnreadNotification && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ) : null}
          {onProfilePress ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onProfilePress}
              activeOpacity={0.75}
            >
              <User size={18} color="#FFFFFF" strokeWidth={2} />
            </TouchableOpacity>
          ) : null}
          {onSignOutPress ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onSignOutPress}
              activeOpacity={0.75}
            >
              <LogOut size={17} color="#FFFFFF" strokeWidth={2} />
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>

      {/* Compact row — versi ringkas saat scroll */}
      <Animated.View style={[styles.contentRow, compactStyle]}>
        <TouchableOpacity
          style={styles.profileSection}
          onPress={onProfilePress}
          activeOpacity={0.85}
        >
          <View style={styles.avatarBorderCollapsed}>
            <Avatar name={displayName} source={avatarUrl} size={34} backgroundColor="#1E3A5F" iconFallback />
          </View>
          <View style={styles.userTextCol}>
            <Text style={styles.userNameTextCollapsed} numberOfLines={1}>
              {displayName}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.rightActionsRow}>
          {typeof userSks === 'number' && (
            <View style={styles.sksBadgeCollapsed}>
              <Text style={styles.sksBadgeText}>{userSks} SKS</Text>
            </View>
          )}
          {onProfilePress ? (
            <TouchableOpacity
              style={styles.iconButtonCollapsed}
              onPress={onProfilePress}
              activeOpacity={0.75}
            >
              <User size={17} color="#FFFFFF" strokeWidth={2} />
            </TouchableOpacity>
          ) : null}
          {onSignOutPress ? (
            <TouchableOpacity
              style={styles.iconButtonCollapsed}
              onPress={onSignOutPress}
              activeOpacity={0.75}
            >
              <LogOut size={16} color="#FFFFFF" strokeWidth={2} />
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  gradientContainerCollapsed: {
    paddingBottom: 10,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E0F2FE',
    letterSpacing: 0.2,
  },
  sksBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    marginLeft: 6,
  },
  sksBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatarBorder: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 26,
    padding: 1,
  },
  avatarBorderCollapsed: {
    borderRadius: 19,
  },
  userNameTextCollapsed: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  iconButtonCollapsed: {
    width: 34,
    height: 34,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  sksBadgeCollapsed: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    marginRight: 8,
  },
  userTextCol: {
    marginLeft: 12,
    flex: 1,
  },
  userNameText: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  userNimText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#E0F2FE',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  userDeptText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#BAE6FD',
    marginTop: 1,
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  unreadDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
});