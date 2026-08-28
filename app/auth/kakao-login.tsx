import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewNavigation } from "react-native-webview";
import { getKakaoLoginUrl } from "@/services/auth";

function callbackParams(url: string): { loginCode?: string; error?: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "receipiti:" || parsed.hostname !== "auth" || parsed.pathname !== "/kakao") {
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

export default function KakaoLoginWebViewScreen() {
  const [loading, setLoading] = useState(true);
  const callbackHandled = useRef(false);

  const handleNavigation = useCallback((request: WebViewNavigation): boolean => {
    const params = callbackParams(request.url);
    if (params) {
      if (!callbackHandled.current) {
        callbackHandled.current = true;
        router.replace({ pathname: "/auth/kakao", params });
      }
      return false;
    }

    if (!request.url.startsWith("http://") && !request.url.startsWith("https://")) {
      Linking.openURL(request.url).catch(() => {
        Alert.alert("앱을 열 수 없어요", "카카오 계정으로 로그인을 선택해주세요.");
      });
      return false;
    }

    return true;
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="로그인 닫기"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={26} color="#111827" />
        </Pressable>
        <Text style={styles.title}>카카오 로그인</Text>
        <View style={styles.headerSpacer} />
      </View>

      <WebView
        source={{ uri: getKakaoLoginUrl() }}
        originWhitelist={["http://*", "https://*", "receipiti://*"]}
        onShouldStartLoadWithRequest={handleNavigation}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          if (!callbackHandled.current) {
            Alert.alert("로그인 페이지 오류", "로그인 페이지를 불러오지 못했어요. 다시 시도해주세요.");
          }
        }}
        javaScriptEnabled
        domStorageEnabled
        incognito
        cacheEnabled={false}
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        setSupportMultipleWindows={false}
        style={styles.webView}
      />

      {loading && (
        <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      )}
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
  closeButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", color: "#111827", fontSize: 17, fontWeight: "700" },
  headerSpacer: { width: 36 },
  webView: { flex: 1, backgroundColor: "#FFFFFF" },
  loading: {
    ...StyleSheet.absoluteFillObject,
    top: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
});
