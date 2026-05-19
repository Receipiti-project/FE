import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
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
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}