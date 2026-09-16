import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { styles } from "@/styles/register/receiptStyles";
import {
  formatKRW,
} from "@/constants/mockData";
import {
  parseReceipt,
  PaymentMethod,
  ReceiptOcrResult,
  saveTransaction,
} from "@/services/ocr";
import { useCategories } from "@/contexts/CategoryContext";
import { CategoryPicker } from "@/components/category-picker";
import {
  getCategoryRecommendation,
  resolveCategoryRecommendation,
} from "@/services/api/categoryApi";

const HITSLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const;

function formatAmountInput(value: number): string {
  return value > 0 ? value.toLocaleString("ko-KR") : "";
}

function savedDateParam(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const month = String(validDate.getMonth() + 1).padStart(2, "0");
  const day = String(validDate.getDate()).padStart(2, "0");
  return `${validDate.getFullYear()}-${month}-${day}`;
}

type Step = "idle" | "analyzing" | "review" | "saving";

type Draft = {
  storeName: string;
  purchasedAt: string;
  purchasedAtIso?: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  categoryId: number | null;
  initialCategoryId: number | null;
  categoryConfidence: number;
  categoryMatchedCount: number;
  categoryAutoApplied: boolean;
  userSelectedCategory: boolean;
  memo: string;
  address?: string;
  isManualEntry?: boolean;
};

const PAYMENT_METHODS: PaymentMethod[] = [
  "카드",
  "현금",
  "간편결제",
  "계좌이체",
];

const ANALYSIS_STEPS = [
  { id: "upload", label: "이미지 업로드" },
  { id: "ocr", label: "OCR 텍스트 추출" },
  { id: "classify", label: "카테고리 자동 분류" },
];

export default function ReceiptScreen() {
  const { categories } = useCategories();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const reset = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setImageUri(null);
    setDraft(null);
    setStep("idle");
    setAnalysisStep(0);
  };

  const applyOcrResult = (
    res: ReceiptOcrResult,
    recommendation: ReturnType<typeof resolveCategoryRecommendation>
  ) => {
    setDraft({
      storeName: res.storeName,
      purchasedAt: res.purchasedAt,
      purchasedAtIso: res.purchasedAtIso,
      totalAmount: res.totalAmount,
      paymentMethod: res.paymentMethod,
      categoryId: recommendation.selectedCategoryId,
      initialCategoryId: recommendation.recommendedCategoryId,
      categoryConfidence: recommendation.confidence,
      categoryMatchedCount: recommendation.matchedCount,
      categoryAutoApplied: recommendation.autoApplicable,
      userSelectedCategory: false,
      memo: "",
      address: res.location?.address,
      isManualEntry: res.isManualEntry,
    });
    setStep("review");
  };

  const startFlow = async (uri: string) => {
    setImageUri(uri);
    setDraft(null);
    setStep("analyzing");
    setAnalysisStep(0);

    // 분석 단계 표시 
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setAnalysisStep((p) => Math.min(p + 1, ANALYSIS_STEPS.length - 1));
    }, 420);

    try {
      const res = await parseReceipt(uri);
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      setAnalysisStep(ANALYSIS_STEPS.length - 1);
      const recommendation = res.storeName
        ? await getCategoryRecommendation(res.storeName).catch(() => null)
        : null;
      const decision = resolveCategoryRecommendation(
        recommendation,
        categories
      );
      applyOcrResult(res, decision);
    } catch (e) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      const msg = (e as Error)?.message ?? "";
      if (msg.startsWith("AUTH_EXPIRED:")) {
        Alert.alert("인증 만료", msg.replace("AUTH_EXPIRED:", ""), [{ text: "확인", onPress: reset }]);
      } else {
        Alert.alert("분석 실패", msg || "다시 시도해주세요.", [{ text: "확인", onPress: reset }]);
      }
      setStep("idle");
    }
  };

  const pickFromLibrary = async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted)
      return Alert.alert("권한 필요", "앨범 접근 권한이 필요합니다.");
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (!r.canceled) startFlow(r.assets[0].uri);
  };

  const takePhoto = async () => {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted)
      return Alert.alert("권한 필요", "카메라 접근 권한이 필요합니다.");
    const r = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!r.canceled) startFlow(r.assets[0].uri);
  };

  const updateDraft = (patch: Partial<Draft>) =>
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  const reclassifyDraftStore = async () => {
    const storeName = draft?.storeName.trim();
    if (!storeName) return;

    const recommendation = await getCategoryRecommendation(storeName).catch(() => null);
    const decision = resolveCategoryRecommendation(
      recommendation,
      categories
    );

    setDraft((prev) => {
      if (!prev) return prev;
      const userEditedCategory = prev.userSelectedCategory;
      return {
        ...prev,
        categoryId: userEditedCategory ? prev.categoryId : decision.selectedCategoryId,
        initialCategoryId: decision.recommendedCategoryId,
        categoryConfidence: userEditedCategory
          ? prev.categoryConfidence
          : decision.confidence,
        categoryMatchedCount: userEditedCategory
          ? prev.categoryMatchedCount
          : decision.matchedCount,
        categoryAutoApplied: userEditedCategory
          ? false
          : decision.autoApplicable,
      };
    });
  };

  const onSave = async () => {
    if (!draft) return;
    if (!draft.storeName.trim()) {
      return Alert.alert("입력 확인", "가맹점명을 입력해주세요.");
    }
    if (draft.totalAmount <= 0) {
      return Alert.alert("입력 확인", "총 결제금액이 0원 이상이어야 합니다.");
    }
    if (!draft.categoryId) {
      return Alert.alert("입력 확인", "카테고리를 선택해주세요.");
    }
    setStep("saving");
    try {
      await saveTransaction(
        "receipt",
        {
          ...draft,
          categoryId: draft.userSelectedCategory ? draft.categoryId : undefined,
          defaultCategoryId: draft.categoryAutoApplied ? draft.categoryId : undefined,
          imageUri,
          userEditedCategory: draft.userSelectedCategory,
        },
        { requireServerSave: true }
      );
      Alert.alert("등록 완료", "가계부에 추가되었어요.", [
        {
          text: "확인",
          onPress: () =>
            router.replace({
              pathname: "/(tabs)/budget",
              params: { date: savedDateParam(draft.purchasedAtIso) },
            }),
        },
      ]);
    } catch (error) {
      Alert.alert(
        "저장 실패",
        (error as Error)?.message ?? "잠시 후 다시 시도해주세요."
      );
      setStep("review");
    }
  };


  if (step === "idle" && !imageUri) {
    return (
      <EmptyState onPick={pickFromLibrary} onShoot={takePhoto} />
    );
  }

  if (step === "analyzing") {
    return (
      <AnalyzingState
        imageUri={imageUri}
        currentStep={analysisStep}
        onCancel={reset}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={HITSLOP}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>영수증 검토</Text>
          <TouchableOpacity onPress={reset} style={styles.iconBtn} hitSlop={HITSLOP}>
            <Ionicons name="refresh" size={20} color="#111827" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 이미지 미리보기 */}
          {imageUri && (
            <View style={styles.previewWrap}>
              <Image source={{ uri: imageUri }} style={styles.preview} />
              <TouchableOpacity style={styles.retakeBtn} onPress={pickFromLibrary}>
                <Ionicons name="image-outline" size={14} color="#FFFFFF" />
                <Text style={styles.retakeText}>다시 선택</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.retakeBtn, { right: 110 }]} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={14} color="#FFFFFF" />
                <Text style={styles.retakeText}>다시 촬영</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* AI 추출 결과 안내 */}
          <View style={styles.aiNotice}>
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={11} color="#FFFFFF" />
              <Text style={styles.aiBadgeText}>AI 추출</Text>
            </View>
            <Text style={styles.aiNoticeText}>
              잘못 추출된 부분은 직접 수정해주세요. 수정 내용은 자동분류 학습에
              반영됩니다.
            </Text>
          </View>

          {/* 가맹점명을 인식하지 못했을 때만 경고 */}
          {draft && !draft.isManualEntry && !draft.storeName && (
            <View style={styles.warnNotice}>
              <Ionicons name="warning-outline" size={14} color="#B45309" />
              <Text style={styles.warnText}>
                가맹점명을 인식하지 못했어요. 직접 입력해주세요.
              </Text>
            </View>
          )}

          {/* 가맹점 / 결제일시 */}
          <View style={styles.card}>
            <Field label="가맹점명">
              <TextInput
                style={styles.input}
                value={draft?.storeName ?? ""}
                onChangeText={(v) => updateDraft({ storeName: v })}
                onEndEditing={() => void reclassifyDraftStore()}
                placeholder="가맹점명을 입력하세요"
                placeholderTextColor="#9CA3AF"
              />
            </Field>
            <Field label="결제일시">
              <View style={styles.readonlyRow}>
                <Ionicons name="time-outline" size={16} color="#6B7280" />
                <Text style={styles.readonlyText}>
                  {draft?.purchasedAt ?? "—"}
                </Text>
              </View>
            </Field>
            {draft?.address && (
              <Field label="위치">
                <View style={styles.readonlyRow}>
                  <Ionicons name="location-outline" size={16} color="#6B7280" />
                  <Text style={styles.readonlyText}>{draft.address}</Text>
                </View>
              </Field>
            )}
          </View>

          {/* 결제수단 */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>결제수단</Text>
            <View style={styles.chipRow}>
              {PAYMENT_METHODS.map((m) => {
                const active = draft?.paymentMethod === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => updateDraft({ paymentMethod: m })}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 카테고리 */}
          <View style={styles.card}>
            <View style={styles.cardLabelRow}>
              <Text style={styles.cardLabel}>카테고리</Text>
              {draft && (
                <View
                  style={[
                    styles.confPill,
                    {
                      backgroundColor:
                        draft.categoryConfidence >= 0.9
                          ? "#ECFDF5"
                          : "#FFF7ED",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.confPillText,
                      {
                        color:
                          draft.categoryConfidence >= 0.9
                            ? "#059669"
                            : "#D97706",
                      },
                    ]}
                  >
                    AI 신뢰도 {Math.round(draft.categoryConfidence * 100)}%
                  </Text>
                </View>
              )}
            </View>
            <CategoryPicker
              selectedId={draft?.categoryId ?? null}
              recommendedCategoryId={draft?.initialCategoryId}
              onSelect={(categoryId) => updateDraft({
                categoryId,
                categoryAutoApplied: false,
                userSelectedCategory: true,
              })}
            />
            {draft?.initialCategoryId && !draft.userSelectedCategory && (
              <Text style={styles.inputHint}>
                {draft.categoryAutoApplied
                  ? `선택 이력 ${draft.categoryMatchedCount}회 · 자동 적용`
                  : `선택 이력 ${draft.categoryMatchedCount}회 · 추천 카테고리를 확인해 주세요.`}
              </Text>
            )}
            {draft?.userSelectedCategory && draft.categoryId !== draft.initialCategoryId && (
              <View style={styles.feedbackBox}>
                <Ionicons name="bulb-outline" size={14} color="#7C3AED" />
                <Text style={styles.feedbackText}>
                  수정한 분류({categories.find((category) => category.categoryId === draft.categoryId)?.name})를 기억하고
                  같은 매장에 자동 적용해요.
                </Text>
              </View>
            )}
          </View>

          {/* 총액 */}
          <View style={[styles.card, styles.totalCard]}>
            <Text style={styles.totalLabel}>총 결제금액</Text>
            <TextInput
              style={styles.totalInput}
              value={draft ? formatAmountInput(draft.totalAmount) : ""}
              onChangeText={(v) =>
                updateDraft({
                  totalAmount: parseInt(v.replace(/[^0-9]/g, ""), 10) || 0,
                })
              }
              keyboardType="number-pad"
              placeholder="0"
            />
            <Text style={styles.totalSuffix}>원</Text>
          </View>

          {/* 메모 */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>메모 (선택)</Text>
            <TextInput
              style={[styles.input, styles.memoInput]}
              value={draft?.memo ?? ""}
              onChangeText={(v) => updateDraft({ memo: v })}
              multiline
              placeholder="이 결제와 관련된 메모를 남겨두세요"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* 하단 저장 버튼 */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            onPress={onSave}
            disabled={step === "saving"}
            style={[styles.saveBtn, step === "saving" && { opacity: 0.6 }]}
          >
            {step === "saving" ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>
                  {draft ? `${formatKRW(draft.totalAmount)} 등록` : "등록"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function EmptyState({
  onPick,
  onShoot,
}: {
  onPick: () => void;
  onShoot: () => void;
}) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={HITSLOP}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>영수증으로 등록</Text>
        <View style={styles.iconBtn} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.emptyTitle}>
          영수증을 찍으면 자동으로 입력해드려요
        </Text>
        <Text style={styles.emptySub}>
          가맹점, 결제일시, 품목, 총 금액까지 OCR로 추출하고 카테고리도 AI가
          자동 분류합니다.
        </Text>
        <View style={styles.featureRow}>
          {[
            { icon: "scan-outline", label: "OCR 추출" },
            { icon: "sparkles-outline", label: "자동 분류" },
            { icon: "create-outline", label: "수정 가능" },
          ].map((f) => (
            <View key={f.label} style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Ionicons name={f.icon as any} size={18} color="#3B82F6" />
              </View>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.bigPrimary} onPress={onShoot}>
          <Ionicons name="camera" size={20} color="#FFFFFF" />
          <Text style={styles.bigPrimaryText}>카메라로 촬영</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bigSecondary} onPress={onPick}>
          <Ionicons name="images-outline" size={20} color="#2563EB" />
          <Text style={styles.bigSecondaryText}>앨범에서 선택</Text>
        </TouchableOpacity>

        <View style={styles.tipBox}>
          <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
          <Text style={styles.tipBoxText}>
            영수증이 잘 나오게 평평하게 펴서 모서리가 모두 보이도록 찍어주세요.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AnalyzingState({
  imageUri,
  currentStep,
  onCancel,
}: {
  imageUri: string | null;
  currentStep: number;
  onCancel: () => void;
}) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onCancel} style={styles.iconBtn} hitSlop={HITSLOP}>
          <Ionicons name="close" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>분석 중</Text>
        <View style={styles.iconBtn} />
      </View>
      <View style={{ padding: 20, alignItems: "center" }}>
        {imageUri && (
          <View style={styles.analyzePreviewWrap}>
            <Image
              source={{ uri: imageUri }}
              style={styles.analyzePreview}
            />
            <View style={styles.scanlineOverlay}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          </View>
        )}
        <Text style={styles.analyzeHeading}>영수증을 읽고 있어요</Text>
        <View style={styles.stepList}>
          {ANALYSIS_STEPS.map((s, i) => {
            const done = i < currentStep;
            const active = i === currentStep;
            return (
              <View key={s.id} style={styles.stepRow}>
                <View
                  style={[
                    styles.stepBadge,
                    done && {
                      backgroundColor: "#10B981",
                      borderColor: "#10B981",
                    },
                    active && {
                      backgroundColor: "#3B82F6",
                      borderColor: "#3B82F6",
                    },
                  ]}
                >
                  {done ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  ) : active ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.stepBadgeNum}>{i + 1}</Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    (done || active) && { color: "#111827", fontWeight: "700" },
                  ]}
                >
                  {s.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}
