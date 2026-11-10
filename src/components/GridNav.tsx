import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BookOpen,
  FileText,
  GraduationCap,
  User,
  HelpCircle,
} from 'lucide-react-native';
import { Colors } from '@/theme/theme';

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
      color: '#0A4C8F',
      bgColor: '#E0F2FE',
    },
    {
      id: 'skripsiku',
      label: 'Skripsi Ku',
      icon: FileText,
      route: '/skripsiku',
      color: '#059669',
      bgColor: '#ECFDF5',
    },
    {
      id: 'profil',
      label: 'Profil',
      icon: User,
      route: '/profil',
      color: '#7C3AED',
      bgColor: '#F5F3FF',
    },
    {
      id: 'panduan',
      label: 'Panduan',
      icon: HelpCircle,
      route: '/panduan',
      color: '#EA580C',
      bgColor: '#FFF7ED',
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
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: menu.bgColor }]}>
              <IconComponent size={24} color={menu.color} strokeWidth={2} />
            </View>
            <Text style={styles.menuLabel}>{menu.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  menuItem: {
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  menuLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
});
