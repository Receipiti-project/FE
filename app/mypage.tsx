import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { styles } from "@/styles/mypageStyles";

export default function MyPageScreen() {
  const { signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    Alert.alert("로그아웃", "Receipiti에서 로그아웃할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: async () => {
          if (loggingOut) return;
          setLoggingOut(true);
          try {
            await signOut();
          } catch (error) {
            setLoggingOut(false);
            Alert.alert(
              "로그아웃 실패",
              (error as Error)?.message ?? "잠시 후 다시 시도해주세요."
            );
          }
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="뒤로 가기"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </Pressable>
          <Text style={styles.headerTitle}>마이페이지</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={34} color="#3B82F6" />
            </View>
            <View style={styles.profileText}>
              <Text style={styles.profileName}>Receipiti 회원</Text>
              <View style={styles.loginMethod}>
                <Ionicons name="chatbubble" size={13} color="#7C6500" />
                <Text style={styles.loginMethodText}>카카오 계정으로 로그인 중</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>계정</Text>
            <Pressable
              accessibilityRole="button"
              disabled={loggingOut}
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.menuRow,
                pressed && styles.menuRowPressed,
                loggingOut && styles.menuRowDisabled,
              ]}
            >
              <View style={styles.logoutIcon}>
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              </View>
              <Text style={styles.logoutText}>로그아웃</Text>
              {loggingOut ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              )}
            </Pressable>
          </View>

          <Text style={styles.version}>Receipiti 1.0.0</Text>
        </View>
      </SafeAreaView>
    </>
  );
}
