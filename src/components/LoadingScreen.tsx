import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Animated, Image } from 'react-native';
import { Colors } from '@/theme/theme';

const logoImage = require('@/assets/images/logo.png');

type LoadingScreenProps = {
  message?: string;
};

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Memuat...' }) => {
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: pulse }}>
        <Image source={logoImage} style={styles.logoImage} resizeMode="contain" />
      </Animated.View>
      <Text style={styles.text}>{message}</Text>
      <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 14 }} />
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
  logoImage: {
    width: 110,
    height: 110,
  },
  text: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
