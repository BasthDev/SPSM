import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors } from '@/theme/theme';

type LoadingScreenProps = {
  message?: string;
};

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Memuat...' }) => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 24,
  },
  card: {
    backgroundColor: Colors.card,
    paddingVertical: 28,
    paddingHorizontal: 36,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  text: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
