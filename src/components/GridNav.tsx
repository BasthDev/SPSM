import { Colors } from '@/theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  BookOpen,
  FileText,
  HelpCircle,
  Settings,
} from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type GridNavProps = {
  style?: any;
};

export const GridNav: React.FC<GridNavProps> = ({ style }) => {
  const router = useRouter();

  const menus = [
    {
      id: 'repo',
      label: 'Repo',
      icon: BookOpen,
      route: '/repo',
    },
    {
      id: 'skripsiku',
      label: 'Skripsi Ku',
      icon: FileText,
      route: '/skripsiku',
    },
    {
      id: 'panduan',
      label: 'Panduan',
      icon: HelpCircle,
      route: '/panduan',
    },
    {
      id: 'pengaturan',
      label: 'Pengaturan',
      icon: Settings,
      route: '/settings',
    },
  ];

  return (
    <View style={[styles.container, style]}>
      {menus.map((menu) => {
        const IconComponent = menu.icon;
        return (
          <TouchableOpacity
            key={menu.id}
            style={styles.menuItem}
            onPress={() => router.push(menu.route as any)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientCard}
            >
              <IconComponent size={20} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.menuLabel} numberOfLines={1}>
                {menu.label}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  menuItem: {
    flex: 1,
    aspectRatio: 1,
    marginHorizontal: 5,
    borderRadius: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  gradientCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    paddingHorizontal: 6,
  },
  menuLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.1,
    marginTop: 6,
  },
});
