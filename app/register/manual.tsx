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
import { formatCurrencyAmount, formatKRW } from "@/constants/mockData";
import {
  createExpenditure,
  nowAsDatetimeLocal,
  datetimeLocalToIso,
  expenditureDateParam,
} from "@/services/api/expenditureApi";
import {
  getCategoryRecommendation,
  resolveCategoryRecommendation,
} from "@/services/api/categoryApi";
import { useCategories } from "@/contexts/CategoryContext";
import { CategoryPicker } from "@/components/category-picker";
import { useKeyboardHeight } from "@/scripts/useKeyboardHeight";
import DateTimePicker from "@react-native-community/datetimepicker";

const HITSLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const;

type PickerMode = "date" | "time";

function asDate(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function asDatetimeLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

type Form = {
  storeName: string;
  amount: string;
  expenditureDate: string; // "YYYY-MM-DDTHH:mm"
  categoryId: number | null;
  recommendedCategoryId: number | null;
  categoryConfidence: number;
  matchedCount: number;
  categoryAutoApplied: boolean;
  userEditedCategory: boolean;
  memo: string;
};

const DEFAULT_FORM: Form = {
  storeName: "",
  amount: "",
  expenditureDate: nowAsDatetimeLocal(),
  categoryId: null,
  recommendedCategoryId: null,
  categoryConfidence: 0,
  matchedCount: 0,
  categoryAutoApplied: false,
  userEditedCategory: false,
  memo: "",
};

export default function ManualScreen() {
  const { categories } = useCategories();
  const keyboardHeight = useKeyboardHeight();
  const [form, setForm] = useState<Form>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [androidPickerMode, setAndroidPickerMode] = useState<PickerMode | null>(null);

  const update = (patch: Partial<Form>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const classifyStore = async () => {
    const storeName = form.storeName.trim();
    if (!storeName) return;

    const recommendation = await getCategoryRecommendation(storeName).catch(() => null);
    const decision = resolveCategoryRecommendation(
      recommendation,
      categories
    );

    setForm((prev) => ({
      ...prev,
      categoryId: prev.userEditedCategory
        ? prev.categoryId
        : decision.selectedCategoryId,
      recommendedCategoryId: decision.recommendedCategoryId,
      categoryConfidence: decision.confidence,
      matchedCount: decision.matchedCount,
      categoryAutoApplied: decision.autoApplicable,
    }));
  };

  const validate = (): string | null => {
    if (!form.storeName.trim()) return "가맹점명을 입력해주세요.";
    const amt = parseInt(form.amount.replace(/[^0-9]/g, ""), 10);
    if (!amt || amt <= 0) return "금액을 올바르게 입력해주세요.";
    if (!form.expenditureDate) return "날짜를 입력해주세요.";
    if (!form.categoryId) return "카테고리를 선택해주세요.";
    return null;
  };

  const onSave = async () => {
    const err = validate();
    if (err) return Alert.alert("입력 확인", err);

    const amount = parseInt(form.amount.replace(/[^0-9]/g, ""), 10);
    const expenditureDate = datetimeLocalToIso(form.expenditureDate);
    setSaving(true);

    try {
      await createExpenditure({
        categoryId: form.userEditedCategory ? form.categoryId! : undefined,
        defaultCategoryId: form.categoryAutoApplied ? form.categoryId! : undefined,
        storeName: form.storeName.trim(),
        amount,
        expenditureDate,
        memo: form.memo.trim() || undefined,
        currency: "KRW",
      });

      Alert.alert("등록 완료", "가계부에 추가되었어요.", [
        {
          text: "확인",
          onPress: () => router.replace({
            pathname: "/(tabs)/budget",
            params: { date: expenditureDateParam(expenditureDate) },
          }),
        },
      ]);
    } catch (e) {
      Alert.alert("저장 실패", (e as Error)?.message ?? "잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const amountNum = parseInt(form.amount.replace(/[^0-9]/g, ""), 10) || 0;
  const selectedDateTime = asDate(form.expenditureDate);

  const changeDateTime = (mode: PickerMode, selected?: Date) => {
    if (!selected) return;
    setForm((previous) => {
      const next = asDate(previous.expenditureDate);
      if (mode === "date") {
        next.setFullYear(
          selected.getFullYear(),
          selected.getMonth(),
          selected.getDate()
        );
      } else {
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      }
      return { ...previous, expenditureDate: asDatetimeLocal(next) };
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[
          { flex: 1 },
          Platform.OS === "android" && { paddingBottom: keyboardHeight },
        ]}
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
              onChangeText={(storeName) => update({ storeName })}
              onEndEditing={() => void classifyStore()}
              placeholder="가맹점명을 입력하세요"
              placeholderTextColor="#9CA3AF"
              returnKeyType="next"
            />
          </View>

          {/* 금액 */}
          <View style={styles.card}>
            <FieldLabel label="금액" required />
            <View style={styles.amountInputShell}>
              <TextInput
                style={styles.amountInput}
                value={amountNum > 0 ? formatCurrencyAmount(amountNum) : ""}
                onChangeText={(v) =>
                  update({ amount: v.replace(/[^0-9]/g, "") })
                }
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.amountUnit}>원</Text>
            </View>
            {amountNum > 0 && (
              <Text style={styles.amountPreview}>
                {formatKRW(amountNum)}
              </Text>
            )}
          </View>

          {/* 날짜 */}
          <View style={styles.card}>
            <FieldLabel label="결제 일시" required />
            <View style={styles.dateTimeRow}>
              <View style={styles.dateTimeControl}>
                <View style={styles.dateTimeLabelRow}>
                  <Ionicons name="calendar-outline" size={15} color="#3B82F6" />
                  <Text style={styles.dateTimeLabel}>날짜</Text>
                </View>
                {Platform.OS === "ios" ? (
                  <DateTimePicker
                    value={selectedDateTime}
                    mode="date"
                    display="compact"
                    locale="ko-KR"
                    maximumDate={new Date()}
                    accentColor="#3B82F6"
                    onChange={(_, selected) => changeDateTime("date", selected)}
                  />
                ) : (
                  <TouchableOpacity
                    onPress={() => setAndroidPickerMode("date")}
                    style={styles.androidDateButton}
                  >
                    <Text style={styles.androidDateText}>
                      {selectedDateTime.toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.dateTimeControl}>
                <View style={styles.dateTimeLabelRow}>
                  <Ionicons name="time-outline" size={15} color="#3B82F6" />
                  <Text style={styles.dateTimeLabel}>시간</Text>
                </View>
                {Platform.OS === "ios" ? (
                  <DateTimePicker
                    value={selectedDateTime}
                    mode="time"
                    display="compact"
                    locale="ko-KR"
                    minuteInterval={1}
                    accentColor="#3B82F6"
                    onChange={(_, selected) => changeDateTime("time", selected)}
                  />
                ) : (
                  <TouchableOpacity
                    onPress={() => setAndroidPickerMode("time")}
                    style={styles.androidDateButton}
                  >
                    <Text style={styles.androidDateText}>
                      {selectedDateTime.toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {Platform.OS !== "ios" && androidPickerMode && (
              <DateTimePicker
                value={selectedDateTime}
                mode={androidPickerMode}
                maximumDate={androidPickerMode === "date" ? new Date() : undefined}
                onChange={(event, selected) => {
                  const mode = androidPickerMode;
                  setAndroidPickerMode(null);
                  if (event.type !== "dismissed") changeDateTime(mode, selected);
                }}
              />
            )}
          </View>

          {/* 카테고리 */}
          <View style={styles.card}>
            <FieldLabel label="카테고리" />
            <CategoryPicker
              selectedId={form.categoryId}
              recommendedCategoryId={form.recommendedCategoryId}
              onSelect={(categoryId) => update({
                categoryId,
                categoryAutoApplied: false,
                userEditedCategory: true,
              })}
            />
            {form.recommendedCategoryId && (
              <Text style={styles.inputHint}>
                {form.categoryAutoApplied
                  ? `선택 이력 ${form.matchedCount}회 · 신뢰도 ${Math.round(form.categoryConfidence * 100)}%로 자동 적용했어요.`
                  : `선택 이력 ${form.matchedCount}회 · 추천 카테고리를 확인해 주세요.`}
              </Text>
            )}
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
                  {amountNum > 0
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
  amountInputShell: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingRight: 12,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "right",
    color: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  amountUnit: { color: "#111827", fontSize: 16, fontWeight: "700" },
  amountPreview: {
    textAlign: "right",
    color: "#3B82F6",
    fontWeight: "700",
    fontSize: 13,
    marginTop: 6,
  },
  inputHint: {
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 5,
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 10,
  },
  dateTimeControl: {
    flex: 1,
    minHeight: 78,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    justifyContent: "space-between",
  },
  dateTimeLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dateTimeLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
  },
  androidDateButton: {
    minHeight: 34,
    justifyContent: "center",
  },
  androidDateText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
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
