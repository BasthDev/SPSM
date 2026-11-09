import { Stack } from 'expo-router';

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
