import { useEffect, useRef } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function KakaoCallbackScreen() {
  const { completeSignIn } = useAuth();
  const params = useLocalSearchParams<{
    loginCode?: string | string[];
    error?: string | string[];
  }>();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const loginCode = firstParam(params.loginCode);
    const oauthError = firstParam(params.error);

    if (oauthError || !loginCode) {
      Alert.alert(
        "로그인 실패",
        oauthError || "일회용 로그인 코드를 받지 못했어요.",
        [{ text: "확인", onPress: () => router.replace("/login") }]
      );
      return;
    }

    completeSignIn(loginCode).catch((error) => {
      Alert.alert(
        "로그인 실패",
        (error as Error)?.message ?? "로그인 코드가 만료됐어요. 다시 시도해주세요.",
        [{ text: "확인", onPress: () => router.replace("/login") }]
      );
    });
  }, [completeSignIn, params.error, params.loginCode]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.text}>카카오 로그인을 완료하고 있어요...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  text: { color: "#4B5563", fontSize: 15, fontWeight: "600" },
});
