import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { CartProvider } from "@/src/context/cart";
import { queryClient } from "@/src/query-client";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // One app level ErrorBoundary; a render crash shows a reload screen
  // instead of a blank app.
  const [fontsLoaded] = useFonts({
    "PlusJakartaSans-Regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    "PlusJakartaSans-SemiBold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    "PlusJakartaSans-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "PlusJakartaSans-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <CartProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </CartProvider>
        </KeyboardProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
