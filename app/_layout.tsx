import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { initCategoryMapping } from "@/services/categoryMapping";

export default function RootLayout() {
  useEffect(() => {
    initCategoryMapping();
  }, []);

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="register/index" options={{ headerShown: false }} />
        <Stack.Screen name="register/receipt" options={{ headerShown: false }} />
        <Stack.Screen name="register/capture" options={{ headerShown: false }} />
        <Stack.Screen name="register/voice" options={{ headerShown: false }} />
        <Stack.Screen name="register/sms" options={{ headerShown: false }} />
        <Stack.Screen name="register/manual" options={{ headerShown: false }} />
        <Stack.Screen name="expenditure/[id]" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}