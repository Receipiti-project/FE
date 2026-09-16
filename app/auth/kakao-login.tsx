import { useEffect, useRef } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { getKakaoLoginUrl } from "@/services/auth";

const KAKAO_CALLBACK_URL = "receipiti://auth/kakao";

function callbackParams(url: string): { loginCode?: string; error?: string } | null {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "receipiti:" ||
      parsed.hostname !== "auth" ||
      parsed.pathname !== "/kakao"
    ) {
      return null;
    }

    return {
      loginCode: parsed.searchParams.get("loginCode") ?? undefined,
      error: parsed.searchParams.get("error") ?? undefined,
    };
  } catch {
    return null;
  }
}

export default function KakaoLoginScreen() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const startLogin = async () => {
      try {
        const result = await WebBrowser.openAuthSessionAsync(
          getKakaoLoginUrl(),
          KAKAO_CALLBACK_URL,
          {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          }
        );

        if (result.type !== "success") {
          router.replace("/login");
          return;
        }

        const params = callbackParams(result.url);
        if (!params) {
          throw new Error("로그인 결과 주소를 확인할 수 없어요.");
        }

        router.replace({ pathname: "/auth/kakao", params });
      } catch (error) {
        Alert.alert(
          "로그인 실패",
          (error as Error)?.message ?? "카카오 로그인 창을 열지 못했어요.",
          [{ text: "확인", onPress: () => router.replace("/login") }]
        );
      }
    };

    void startLogin();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="로그인 닫기"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.replace("/login")}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={26} color="#111827" />
        </Pressable>
        <Text style={styles.title}>카카오 로그인</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.statusText}>카카오 로그인 창을 여는 중이에요...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    paddingHorizontal: 16,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: "#111827",
    fontSize: 17,
    fontWeight: "700",
  },
  headerSpacer: { width: 36 },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  statusText: { color: "#4B5563", fontSize: 15, fontWeight: "600" },
});
