import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { styles } from "@/styles/mypageStyles";
import { formatKRW } from "@/constants/mockData";
import { useBudget } from "@/contexts/BudgetContext";

export default function MyPageScreen() {
  const { signOut } = useAuth();
  const { monthlyBudget, setMonthlyBudget } = useBudget();
  const [loggingOut, setLoggingOut] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(monthlyBudget));
  const [savingBudget, setSavingBudget] = useState(false);

  const startBudgetEdit = () => {
    setBudgetInput(String(monthlyBudget));
    setEditingBudget(true);
  };

  const saveBudget = async () => {
    const amount = Number(budgetInput.replace(/[^0-9]/g, ""));
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      Alert.alert("입력 확인", "월 예산을 1원 이상 입력해 주세요.");
      return;
    }
    setSavingBudget(true);
    try {
      await setMonthlyBudget(amount);
      setEditingBudget(false);
    } catch (error) {
      Alert.alert("저장 실패", (error as Error)?.message ?? "잠시 후 다시 시도해 주세요.");
    } finally {
      setSavingBudget(false);
    }
  };

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

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
            <Text style={styles.sectionTitle}>소비 설정</Text>
            <View style={styles.budgetCard}>
              <View style={styles.budgetHeader}>
                <View style={styles.budgetIcon}>
                  <Ionicons name="wallet-outline" size={20} color="#3B82F6" />
                </View>
                <View style={styles.budgetCopy}>
                  <Text style={styles.budgetLabel}>월 예산</Text>
                  {!editingBudget && (
                    <Text style={styles.budgetValue}>{formatKRW(monthlyBudget)}</Text>
                  )}
                </View>
                {!editingBudget && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={startBudgetEdit}
                    style={({ pressed }) => [styles.budgetEditButton, pressed && styles.menuRowPressed]}
                  >
                    <Text style={styles.budgetEditText}>수정</Text>
                  </Pressable>
                )}
              </View>

              {editingBudget && (
                <View style={styles.budgetEditor}>
                  <View style={styles.budgetInputRow}>
                    <TextInput
                      autoFocus
                      keyboardType="number-pad"
                      maxLength={12}
                      onChangeText={(value) => setBudgetInput(value.replace(/[^0-9]/g, ""))}
                      placeholder="600000"
                      placeholderTextColor="#9CA3AF"
                      style={styles.budgetInput}
                      value={
                        Number(budgetInput) > 0
                          ? Number(budgetInput).toLocaleString("ko-KR")
                          : ""
                      }
                    />
                    <Text style={styles.budgetUnit}>원</Text>
                  </View>
                  {!!Number(budgetInput) && (
                    <Text style={styles.budgetPreview}>{formatKRW(Number(budgetInput))}</Text>
                  )}
                  <View style={styles.budgetActions}>
                    <Pressable
                      disabled={savingBudget}
                      onPress={() => setEditingBudget(false)}
                      style={styles.budgetCancelButton}
                    >
                      <Text style={styles.budgetCancelText}>취소</Text>
                    </Pressable>
                    <Pressable
                      disabled={savingBudget}
                      onPress={() => void saveBudget()}
                      style={[styles.budgetSaveButton, savingBudget && styles.menuRowDisabled]}
                    >
                      {savingBudget ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.budgetSaveText}>저장</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>계정</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/categories")}
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
            >
              <View style={styles.categoryIcon}>
                <Ionicons name="pricetags-outline" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.menuText}>카테고리 관리</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={loggingOut}
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.menuRow,
                styles.logoutRow,
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
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
