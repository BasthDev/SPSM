import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { User, LogOut, Bell } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { Colors } from '@/theme/theme';

interface HomeHeaderProps {
  userName?: string;
  userSubtitle?: string;
  avatarUrl?: string | null;
  greeting?: string;
  onProfilePress?: () => void;
  onSignOutPress?: () => void;
  onNotificationPress?: () => void;
  hasUnreadNotification?: boolean;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  userName,
  userSubtitle,
  avatarUrl,
  greeting = 'Selamat Datang',
  onProfilePress,
  onSignOutPress,
  onNotificationPress,
  hasUnreadNotification = false,
}) => {
  const insets = useSafeAreaInsets();
  const displayName = userName && userName.trim().length > 0 ? userName : 'Mahasiswa';

  return (
    <LinearGradient
      colors={[Colors.primary, Colors.primaryLight]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.gradientContainer,
        { paddingTop: insets.top + 12 },
      ]}
    >
      <StatusBar style="light" />

      {/* Subtle Ambient Glow Effect overlay */}
      <View style={styles.ambientGlow} pointerEvents="none" />

      {/* Content Row */}
      <View style={styles.contentRow}>
        {/* Left: Avatar + Greeting + Nama */}
        <TouchableOpacity
          style={styles.profileSection}
          onPress={onProfilePress}
          activeOpacity={0.85}
        >
          <View style={styles.avatarBorder}>
            <Avatar name={displayName} source={avatarUrl} size={46} backgroundColor="#2563EB" />
          </View>

          <View style={styles.userTextCol}>
            <Text style={styles.greetingText}>{greeting}</Text>
            <Text style={styles.userNameText} numberOfLines={1}>
              {displayName}
            </Text>
            {userSubtitle ? (
              <Text style={styles.userSubtitleText} numberOfLines={1}>
                {userSubtitle}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        {/* Right: Glassmorphic Action Buttons */}
        <View style={styles.rightActionsRow}>
          {onNotificationPress ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onNotificationPress}
              activeOpacity={0.75}
            >
              <Bell size={18} color="#fff" strokeWidth={2} />
              {hasUnreadNotification && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ) : null}

          {onProfilePress ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onProfilePress}
              activeOpacity={0.75}
            >
              <User size={18} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          ) : null}

          {onSignOutPress ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onSignOutPress}
              activeOpacity={0.75}
            >
              <LogOut size={17} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#0A4C8F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  ambientGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    borderColor: '#ffffff',
    borderRadius: 25,
    padding: 1,
  },
  userTextCol: {
    marginLeft: 12,
    flex: 1,
  },
  greetingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#BAE6FD',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  userNameText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 1,
  },
  userSubtitleText: {
    fontSize: 12,
    color: '#E0F2FE',
    marginTop: 1,
    fontWeight: '500',
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    position: 'relative',
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
