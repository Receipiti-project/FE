import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CategoryProvider } from "@/contexts/CategoryContext";
import { BudgetProvider } from "@/contexts/BudgetContext";

function RootNavigator() {
  const { ready, signedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const onLoginScreen = segments[0] === "login";
    const onAuthCallback = segments[0] === "auth";
    if (!signedIn && !onLoginScreen && !onAuthCallback) router.replace("/login" as never);
    if (signedIn && (onLoginScreen || onAuthCallback)) router.replace("/(tabs)" as never);
  }, [ready, router, segments, signedIn]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }}>
        <ActivityIndicator color="#3B82F6" />
      </View>
    );
  }

  return (
    <>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="auth/kakao-login" options={{ headerShown: false }} />
        <Stack.Screen name="auth/kakao" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="register/index" options={{ headerShown: false }} />
        <Stack.Screen name="register/receipt" options={{ headerShown: false }} />
        <Stack.Screen name="register/capture" options={{ headerShown: false }} />
        <Stack.Screen name="register/voice" options={{ headerShown: false }} />
        <Stack.Screen name="register/sms" options={{ headerShown: false }} />
        <Stack.Screen name="register/manual" options={{ headerShown: false }} />
        <Stack.Screen name="expenditure/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="report/monthly-ai" options={{ headerShown: false }} />
        <Stack.Screen name="categories" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <BudgetProvider>
        <CategoryProvider>
          <RootNavigator />
        </CategoryProvider>
      </BudgetProvider>
    </AuthProvider>
  );
}
