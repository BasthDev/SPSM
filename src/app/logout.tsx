import { authService } from '@/services/authService';
import { userDataCache } from '@/services/userDataCache';
import { Colors } from '@/theme/theme';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, BackHandler, StyleSheet, Text, View } from 'react-native';

export default function LogoutScreen() {
  const router = useRouter();

  // Block hardware back button
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => handler.remove();
  }, []);

  // Perform logout once when component mounts
  useEffect(() => {
    (async () => {
      try {
        await authService.logout();
        void userDataCache.clear();
        router.replace('/login');
      } catch (e) {
        Alert.alert('Logout gagal', (e as any).message ?? 'Tidak dapat keluar');
        router.replace('/login');
      }
    })();
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.message}>Sedang keluar...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  message: {
    fontSize: 16,
    color: Colors.primary,
  },
});
