import { Stack, ErrorBoundary } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Catch any errors thrown by the Layout component.
export { ErrorBoundary };

const queryClient = new QueryClient();

// Explicitly prevent auto-hide just in case it was called elsewhere, 
// then hide it when the root layout mounts.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Layout() {
  useEffect(() => {
    // Force hide splash screen after 1.5 seconds max or when mounted
    setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 1500);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="dark" />
    </QueryClientProvider>
  );
}
