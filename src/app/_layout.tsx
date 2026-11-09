import { Stack } from 'expo-router';
import { LogBox } from 'react-native';

// Ignore benign warning from having both the app scheme ('spsm') and Appwrite OAuth scheme ('appwrite-callback-...')
LogBox.ignoreLogs([
  'Linking found multiple possible URI schemes in your Expo config',
]);

/**
 * Root layout — defines the root Stack navigator.
 */
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="submission" />
    </Stack>
  );
}
