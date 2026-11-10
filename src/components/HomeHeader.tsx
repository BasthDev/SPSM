import { Colors } from '@/theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Bell, GraduationCap, LogOut, User } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';

interface HomeHeaderProps {
  userName?: string;
  userNim?: string;
  userDepartmentName?: string;
  userSubtitle?: string;
  avatarUrl?: string | null;
  onProfilePress?: () => void;
  onSignOutPress?: () => void;
  onNotificationPress?: () => void;
  hasUnreadNotification?: boolean;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  userName,
  userNim,
  userDepartmentName,
  userSubtitle,
  avatarUrl,
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
        { paddingTop: insets.top + 10 },
      ]}
    >
      <StatusBar style="light" />

      {/* Top Brand & Campus Bar (Clean layout with space-between) */}
      <View style={styles.brandBar}>
        <View style={styles.brandLeft}>
          <GraduationCap size={18} color="#BAE6FD" strokeWidth={2.2} />
          <Text style={styles.brandText}>SPSM Portal</Text>
        </View>
        <Text style={styles.campusText} numberOfLines={1}>
          {/* Universitas Muhammadiyah Aceh */}
        </Text>
      </View>

      {/* Content Row */}
      <View style={styles.contentRow}>
        {/* Left: Avatar + Biodata (Nama, NIM, Nama Lengkap Prodi) */}
        <TouchableOpacity
          style={styles.profileSection}
          onPress={onProfilePress}
          activeOpacity={0.85}
        >
          <View style={styles.avatarBorder}>
            <Avatar name={displayName} source={avatarUrl} size={48} backgroundColor="#1E3A5F" />
          </View>

          <View style={styles.userTextCol}>
            {/* Nama Lengkap Mahasiswa */}
            <Text style={styles.userNameText} numberOfLines={1}>
              {displayName}
            </Text>

            {/* NIM */}
            {userNim ? (
              <Text style={styles.userNimText} numberOfLines={1}>
                NIM: {userNim}
              </Text>
            ) : null}

            {/* Nama Lengkap Program Studi */}
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

        {/* Right: Action Buttons */}
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
      </View>
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
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  campusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#BAE6FD',
    letterSpacing: 0.2,
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