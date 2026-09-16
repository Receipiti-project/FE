import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { styles } from "@/styles/loginStyles";

const FEATURES = [
  { icon: "receipt-outline" as const, text: "영수증을 촬영하면 지출을 자동으로 분석해요" },
  { icon: "pie-chart-outline" as const, text: "소비 내역과 월별 리포트를 한눈에 확인해요" },
  { icon: "shield-checkmark-outline" as const, text: "로그인 정보는 기기의 보안 저장소에 보관해요" },
];

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      router.push("/auth/kakao-login");
    } catch (error) {
      Alert.alert("로그인 실패", (error as Error)?.message ?? "잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.logo}>
            <Ionicons name="wallet-outline" size={38} color="#3B82F6" />
          </View>
          <Text style={styles.title}>Receipiti</Text>
          <Text style={styles.subtitle}>영수증 한 장으로 시작하는{`\n`}간편한 소비 기록</Text>

          <View style={styles.featureList}>
            {FEATURES.map((feature) => (
              <View key={feature.text} style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Ionicons name={feature.icon} size={20} color="#4B5563" />
                </View>
                <Text style={styles.featureText}>{feature.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="카카오로 로그인"
            disabled={loading}
            onPress={handleLogin}
            style={({ pressed }) => [
              styles.loginButton,
              pressed && styles.loginButtonPressed,
              loading && styles.loginButtonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#191919" />
            ) : (
              <Ionicons name="chatbubble" size={20} color="#191919" />
            )}
            <Text style={styles.loginText}>{loading ? "로그인 중..." : "카카오로 시작하기"}</Text>
          </Pressable>
          <Text style={styles.notice}>로그인하면 서비스 이용약관과 개인정보 처리방침에 동의하게 됩니다.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
