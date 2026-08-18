import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { CATEGORIES, CategoryId, formatKRW } from "@/constants/mockData";
import {
  createExpenditure,
  guessCategoryFromStoreName,
  nowAsDatetimeLocal,
  datetimeLocalToIso,
} from "@/services/api/expenditureApi";
import { isApiConfigured } from "@/services/api/config";
import { saveTransaction } from "@/services/ocr";
import { getServerCategoryId } from "@/services/categoryMapping";

const HITSLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const;

const CURRENCY_OPTIONS = ["KRW", "USD", "EUR", "JPY", "CNY"] as const;
type Currency = (typeof CURRENCY_OPTIONS)[number];

type Form = {
  storeName: string;
  amount: string;
  expenditureDate: string; // "YYYY-MM-DDTHH:mm"
  category: CategoryId;
  memo: string;
  currency: Currency;
};

const DEFAULT_FORM: Form = {
  storeName: "",
  amount: "",
  expenditureDate: nowAsDatetimeLocal(),
  category: "etc",
  memo: "",
  currency: "KRW",
};

export default function ManualScreen() {
  const [form, setForm] = useState<Form>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const update = (patch: Partial<Form>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const validate = (): string | null => {
    if (!form.storeName.trim()) return "가맹점명을 입력해주세요.";
    const amt = parseInt(form.amount.replace(/[^0-9]/g, ""), 10);
    if (!amt || amt <= 0) return "금액을 올바르게 입력해주세요.";
    if (!form.expenditureDate) return "날짜를 입력해주세요.";
    return null;
  };

  const onSave = async () => {
    const err = validate();
    if (err) return Alert.alert("입력 확인", err);

    const amount = parseInt(form.amount.replace(/[^0-9]/g, ""), 10);
    setSaving(true);

    try {
      if (isApiConfigured()) {
        await createExpenditure({
          categoryId: getServerCategoryId(form.category),
          storeName: form.storeName.trim(),
          amount,
          expenditureDate: datetimeLocalToIso(form.expenditureDate),
          memo: form.memo.trim() || undefined,
          currency: form.currency,
        });
      } else {
        // API 미연결 시 로컬 임시 저장
        await saveTransaction("manual", {
          storeName: form.storeName.trim(),
          totalAmount: amount,
          purchasedAt: form.expenditureDate,
          category: form.category,
          memo: form.memo.trim(),
          currency: form.currency,
        });
      }

      Alert.alert("등록 완료", "가계부에 추가되었어요.", [
        { text: "확인", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("저장 실패", (e as Error)?.message ?? "잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const amountNum = parseInt(form.amount.replace(/[^0-9]/g, ""), 10) || 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* 헤더 */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconBtn}
            hitSlop={HITSLOP}
          >
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>직접 입력</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* 가맹점명 */}
          <View style={styles.card}>
            <FieldLabel label="가맹점명" required />
            <TextInput
              style={styles.input}
              value={form.storeName}
              onChangeText={(v) => {
                const guessed = guessCategoryFromStoreName(v);
                update({
                  storeName: v,
                  // 사용자가 카테고리를 etc(기본값)로 두고 있을 때만 자동 추천
                  ...(form.category === "etc" && guessed !== "etc"
                    ? { category: guessed }
                    : {}),
                });
              }}
              placeholder="가맹점명을 입력하세요"
              placeholderTextColor="#9CA3AF"
              returnKeyType="next"
            />
          </View>

          {/* 금액 */}
          <View style={styles.card}>
            <FieldLabel label="금액" required />
            <View style={styles.amountRow}>
              <TextInput
                style={[styles.input, styles.amountInput]}
                value={form.amount}
                onChangeText={(v) =>
                  update({ amount: v.replace(/[^0-9]/g, "") })
                }
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
              />
              {/* 통화 선택 */}
              <View style={styles.currencyRow}>
                {CURRENCY_OPTIONS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => update({ currency: c })}
                    style={[
                      styles.currencyChip,
                      form.currency === c && styles.currencyChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.currencyText,
                        form.currency === c && styles.currencyTextActive,
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {amountNum > 0 && form.currency === "KRW" && (
              <Text style={styles.amountPreview}>{formatKRW(amountNum)}</Text>
            )}
          </View>

          {/* 날짜 */}
          <View style={styles.card}>
            <FieldLabel label="결제 일시" required />
            <TextInput
              style={styles.input}
              value={form.expenditureDate}
              onChangeText={(v) => update({ expenditureDate: v })}
              placeholder="YYYY-MM-DDTHH:mm"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "default"}
            />
            <Text style={styles.inputHint}>예: 2026-06-10T14:30</Text>
          </View>

          {/* 카테고리 */}
          <View style={styles.card}>
            <FieldLabel label="카테고리" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {CATEGORIES.map((c) => {
                const active = form.category === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => update({ category: c.id })}
                    style={[
                      styles.catChip,
                      active && {
                        backgroundColor: `${c.color}1A`,
                        borderColor: c.color,
                      },
                    ]}
                  >
                    <Ionicons
                      name={c.icon}
                      size={14}
                      color={active ? c.color : "#6B7280"}
                    />
                    <Text
                      style={[
                        styles.catChipText,
                        active && { color: c.color, fontWeight: "700" },
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* 메모 */}
          <View style={styles.card}>
            <FieldLabel label="메모 (선택)" />
            <TextInput
              style={[styles.input, styles.memoInput]}
              value={form.memo}
              onChangeText={(v) => update({ memo: v })}
              multiline
              placeholder="이 결제와 관련된 메모를 남겨두세요"
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
            />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* 하단 저장 버튼 */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            onPress={onSave}
            disabled={saving}
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>
                  {amountNum > 0 && form.currency === "KRW"
                    ? `${formatKRW(amountNum)} 등록`
                    : "등록"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {label}
      {required && <Text style={{ color: "#EF4444" }}> *</Text>}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 14,
    minHeight: 56,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  scroll: { padding: 16, paddingBottom: 24 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
  },
  amountRow: { gap: 10 },
  amountInput: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "right",
  },
  amountPreview: {
    textAlign: "right",
    color: "#3B82F6",
    fontWeight: "700",
    fontSize: 13,
    marginTop: 6,
  },
  currencyRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  currencyChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "transparent",
  },
  currencyChipActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#3B82F6",
  },
  currencyText: { color: "#6B7280", fontSize: 12, fontWeight: "600" },
  currencyTextActive: { color: "#3B82F6", fontWeight: "700" },
  inputHint: {
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 5,
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  catChipText: { color: "#6B7280", fontSize: 12, fontWeight: "600" },
  memoInput: { minHeight: 70 },
  bottomBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    borderRadius: 14,
  },
  saveBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
});
