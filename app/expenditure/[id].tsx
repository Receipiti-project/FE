import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  CATEGORIES,
  CategoryId,
  formatKRW,
  getCategory,
} from "@/constants/mockData";
import {
  getExpenditure,
  updateExpenditure,
  deleteExpenditure,
  ExpenditureDetail,
  nowLocalIso,
} from "@/services/api/expenditureApi";
import {
  getServerCategoryId,
  getLocalCategoryId,
  nameToLocalCategoryId,
} from "@/services/categoryMapping";

const HITSLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const;

type EditDraft = {
  storeName: string;
  amount: string;
  expenditureDate: string;
  category: CategoryId;
  memo: string;
  currency: string;
};

function isoToLocal(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${mo}-${day} ${hh}:${mm}`;
  } catch {
    return iso;
  }
}

function localToIso(val: string): string {
  if (!val) return nowLocalIso();
  try {
    // 타임존 없으면 그대로 (서버가 로컬로 처리)
    if (!val.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(val)) return val;
    return new Date(val).toISOString();
  } catch {
    return nowLocalIso();
  }
}

function detailToCategory(detail: ExpenditureDetail): CategoryId {
  // categoryName 문자열 매핑 우선 (목록 뷰와 일관성 유지)
  if (detail.categoryName) {
    const fromName = nameToLocalCategoryId(detail.categoryName);
    if (fromName !== "etc") return fromName;
  }
  // fallback: 서버 categoryId → 로컬 ID
  if (detail.categoryId) {
    return getLocalCategoryId(detail.categoryId);
  }
  return "etc";
}

export default function ExpenditureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenditureId = Number(id);

  const [detail, setDetail] = useState<ExpenditureDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);

  useEffect(() => {
    loadDetail();
  }, []);

  async function loadDetail() {
    setLoading(true);
    try {
      const data = await getExpenditure(expenditureId);
      setDetail(data);
      setDraft(toEditDraft(data));
    } catch (e) {
      Alert.alert("오류", "지출 정보를 불러오지 못했어요.");
      router.back();
    } finally {
      setLoading(false);
    }
  }

  function toEditDraft(d: ExpenditureDetail): EditDraft {
    return {
      storeName: d.storeName ?? "",
      amount: String(d.amount ?? 0),
      expenditureDate: isoToLocal(d.expenditureDate),
      category: detailToCategory(d),
      memo: d.memo ?? "",
      currency: d.currency ?? "KRW",
    };
  }

  function updateDraft(patch: Partial<EditDraft>) {
    setDraft((prev) => prev ? { ...prev, ...patch } : prev);
  }

  async function onSave() {
    if (!draft) return;
    if (!draft.storeName.trim()) {
      return Alert.alert("입력 확인", "가맹점명을 입력해주세요.");
    }
    const amount = parseInt(draft.amount.replace(/[^0-9]/g, ""), 10);
    if (!amount || amount <= 0) {
      return Alert.alert("입력 확인", "금액을 올바르게 입력해주세요.");
    }
    setSaving(true);
    try {
      await updateExpenditure(expenditureId, {
        storeName: draft.storeName.trim(),
        amount,
        expenditureDate: localToIso(draft.expenditureDate),
        categoryId: getServerCategoryId(draft.category),
        memo: draft.memo,
        currency: draft.currency,
      });
      Alert.alert("수정 완료", "지출 내역이 수정되었어요.", [
        { text: "확인", onPress: () => { setEditing(false); loadDetail(); } },
      ]);
    } catch (e) {
      Alert.alert("저장 실패", "잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    Alert.alert(
      "삭제 확인",
      "이 지출 내역을 삭제할까요? 되돌릴 수 없어요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteExpenditure(expenditureId);
              router.back();
            } catch {
              Alert.alert("삭제 실패", "잠시 후 다시 시도해주세요.");
            }
          },
        },
      ]
    );
  }

  if (loading || !detail || !draft) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={HITSLOP}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>지출 상세</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.centerBox}>
          <ActivityIndicator color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  const cat = getCategory(draft.category);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        {/* 상단 바 */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => {
              if (editing) { setEditing(false); setDraft(toEditDraft(detail)); }
              else router.back();
            }}
            style={styles.iconBtn}
            hitSlop={HITSLOP}
          >
            <Ionicons name={editing ? "close" : "chevron-back"} size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{editing ? "지출 수정" : "지출 상세"}</Text>
          {!editing ? (
            <TouchableOpacity onPress={() => setEditing(true)} style={styles.iconBtn} hitSlop={HITSLOP}>
              <Ionicons name="create-outline" size={22} color="#3B82F6" />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconBtn} />
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 금액 헤더 카드 */}
          <View style={[styles.amountCard, { borderColor: `${cat.color}33` }]}>
            <View style={[styles.catBadge, { backgroundColor: `${cat.color}1A` }]}>
              <Ionicons name={cat.icon} size={20} color={cat.color} />
              <Text style={[styles.catBadgeText, { color: cat.color }]}>{cat.label}</Text>
            </View>
            {editing ? (
              <TextInput
                style={styles.amountInput}
                value={draft.amount}
                onChangeText={(v) => updateDraft({ amount: v.replace(/[^0-9]/g, "") })}
                keyboardType="number-pad"
                placeholder="0"
              />
            ) : (
              <Text style={styles.amountText}>{formatKRW(detail.amount)}</Text>
            )}
            <Text style={styles.amountCurrency}>{draft.currency}</Text>
          </View>

          {/* 정보 카드 */}
          <View style={styles.card}>
            <InfoRow
              label="가맹점명"
              icon="storefront-outline"
              editing={editing}
              value={draft.storeName}
              onChangeText={(v) => updateDraft({ storeName: v })}
              placeholder="가맹점명 입력"
            />
            <InfoRow
              label="결제일시"
              icon="time-outline"
              editing={editing}
              value={draft.expenditureDate}
              onChangeText={(v) => updateDraft({ expenditureDate: v })}
              placeholder="YYYY-MM-DD HH:mm"
            />
            <InfoRow
              label="메모"
              icon="document-text-outline"
              editing={editing}
              value={draft.memo}
              onChangeText={(v) => updateDraft({ memo: v })}
              placeholder="메모 없음"
              last
            />
          </View>

          {/* 카테고리 선택 (편집 모드) */}
          {editing && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>카테고리</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {CATEGORIES.map((c) => {
                  const active = draft.category === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => updateDraft({ category: c.id })}
                      style={[
                        styles.catChip,
                        active && { backgroundColor: `${c.color}1A`, borderColor: c.color },
                      ]}
                    >
                      <Ionicons name={c.icon} size={14} color={active ? c.color : "#6B7280"} />
                      <Text style={[styles.catChipText, active && { color: c.color, fontWeight: "700" }]}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* 통화 선택 (편집 모드) */}
          {editing && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>통화</Text>
              <View style={styles.chipRow}>
                {["KRW", "USD", "EUR", "JPY", "CNY"].map((cur) => {
                  const active = draft.currency === cur;
                  return (
                    <TouchableOpacity
                      key={cur}
                      onPress={() => updateDraft({ currency: cur })}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{cur}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* 메타 정보 (조회 모드) */}
          {!editing && (
            <View style={styles.metaCard}>
              {detail.inputType && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>입력 방식</Text>
                  <Text style={styles.metaValue}>
                    {detail.inputType === "OCR" ? "영수증 OCR" : detail.inputType === "MANUAL" ? "직접 입력" : "캡처"}
                  </Text>
                </View>
              )}
              {detail.createdAt && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>등록일</Text>
                  <Text style={styles.metaValue}>{isoToLocal(detail.createdAt)}</Text>
                </View>
              )}
              {detail.address && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>위치</Text>
                  <Text style={styles.metaValue}>{detail.address}</Text>
                </View>
              )}
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* 하단 버튼 */}
        <View style={styles.bottomBar}>
          {editing ? (
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
                  <Text style={styles.saveBtnText}>수정 저장</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => setEditing(true)}
                style={styles.saveBtn}
              >
                <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>수정</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                <Text style={styles.deleteBtnText}>삭제</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  icon,
  editing,
  value,
  onChangeText,
  placeholder,
  last,
}: {
  label: string;
  icon: any;
  editing: boolean;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0, marginBottom: 0 }]}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon} size={15} color="#6B7280" />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      {editing ? (
        <TextInput
          style={styles.infoInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#D1D5DB"
        />
      ) : (
        <Text style={styles.infoValue} numberOfLines={2}>
          {value || <Text style={{ color: "#D1D5DB" }}>{placeholder}</Text>}
        </Text>
      )}
    </View>
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
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingBottom: 24 },

  // 금액 헤더
  amountCard: {
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  catBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  catBadgeText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  amountText: { fontSize: 34, fontWeight: "800", color: "#FFFFFF" },
  amountInput: {
    fontSize: 34,
    fontWeight: "800",
    color: "#FFFFFF",
    borderBottomWidth: 2,
    borderBottomColor: "#3B82F6",
    textAlign: "center",
    minWidth: 140,
    paddingVertical: 4,
  },
  amountCurrency: { fontSize: 13, color: "#9CA3AF", fontWeight: "600" },

  // 공통 카드 (receipt.tsx와 동일)
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    marginBottom: 12,
  },
  cardLabel: { fontSize: 13, fontWeight: "700", color: "#111827", marginBottom: 12 },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  infoLeft: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 80 },
  infoLabel: { fontSize: 12, color: "#6B7280", fontWeight: "600" },
  infoValue: { fontSize: 14, color: "#111827", fontWeight: "500", flex: 1, textAlign: "right" },
  infoInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    textAlign: "right",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
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

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipActive: { backgroundColor: "#EFF6FF", borderColor: "#3B82F6" },
  chipText: { color: "#6B7280", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#3B82F6", fontWeight: "700" },

  metaCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  metaKey: { fontSize: 12, color: "#9CA3AF", fontWeight: "600" },
  metaValue: { fontSize: 12, color: "#374151" },

  bottomBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    flexDirection: "row",
    gap: 10,
  },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    borderRadius: 14,
  },
  saveBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  deleteBtnText: { color: "#EF4444", fontWeight: "700", fontSize: 14 },
});
