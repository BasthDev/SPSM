import { ConnectionBanner } from '@/components';
import {
  promptNotificationPermissionOnStart,
  setupNotificationHandler,
} from '@/services/notificationService';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Ignore benign warning from having both the app scheme ('spsm') and Appwrite OAuth scheme ('appwrite-callback-...')
LogBox.ignoreLogs([
  'Linking found multiple possible URI schemes in your Expo config',
]);

/**
 * Root layout — defines the root Stack navigator.
 */
export default function RootLayout() {
  useEffect(() => {
    setupNotificationHandler();
    // Minta izin notifikasi sekali saat app pertama dibuka
    void promptNotificationPermissionOnStart();
  }, []);

  return (
    <SafeAreaProvider>
      <ConnectionBanner />
      <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="logout" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="profile" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="submission" />
      </Stack>
    </SafeAreaProvider>
  );
}
