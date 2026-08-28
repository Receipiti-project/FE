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
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { styles } from "@/styles/register/receiptStyles";
import {
  CATEGORIES,
  CategoryId,
  formatKRW,
  getCategory,
} from "@/constants/mockData";
import {
  ApiNotConfiguredError,
  isServerOcrConfigured,
  OcrServerError,
  parseReceipt,
  parseReceiptFromText,
  PaymentMethod,
  ReceiptOcrResult,
  saveTransaction,
} from "@/services/ocr";

const HITSLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const;

type Step = "idle" | "analyzing" | "review" | "saving";

type ReceiptItem = { name: string; price: number };

type Draft = {
  storeName: string;
  purchasedAt: string;
  purchasedAtIso?: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  category: CategoryId;
  initialCategory: CategoryId;
  categoryConfidence: number;
  items: ReceiptItem[];
  memo: string;
  rawText: string;
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
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [showRaw, setShowRaw] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ocrAvailable = isServerOcrConfigured();

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
    setShowRaw(false);
  };

  const applyOcrResult = (res: ReceiptOcrResult) => {
    setDraft({
      storeName: res.storeName,
      purchasedAt: res.purchasedAt,
      purchasedAtIso: res.purchasedAtIso,
      totalAmount: res.totalAmount,
      paymentMethod: res.paymentMethod,
      category: res.suggestedCategory,
      initialCategory: res.suggestedCategory,
      categoryConfidence: res.categoryConfidence,
      items: res.items.map((i) => ({ name: i.name, price: i.price })),
      memo: "",
      rawText: res.rawText,
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
      applyOcrResult(res);
    } catch (e) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      if (e instanceof ApiNotConfiguredError) {
        Alert.alert(
          "서버가 아직 연결되지 않았어요",
          "지금은 영수증 텍스트를 직접 붙여넣어 등록해보시겠어요?",
          [
            { text: "취소", style: "cancel", onPress: reset },
            {
              text: "텍스트 붙여넣기",
              onPress: () => {
                setStep("idle");
                setPasteOpen(true);
              },
            },
          ]
        );
        return;
      }
      if (e instanceof OcrServerError) {
        Alert.alert(
          "OCR 서버 응답 오류",
          `${e.message}${e.code ? `\n(code: ${e.code})` : ""}`,
          [{ text: "확인", onPress: reset }]
        );
        return;
      }
      const msg = (e as Error)?.message ?? "";
      if (msg.startsWith("AUTH_EXPIRED:")) {
        Alert.alert("인증 만료", msg.replace("AUTH_EXPIRED:", ""), [{ text: "확인", onPress: reset }]);
      } else {
        Alert.alert("분석 실패", msg || "다시 시도해주세요.", [{ text: "확인", onPress: reset }]);
      }
      setStep("idle");
    }
  };

  const startFromPastedText = () => {
    const text = pasteText.trim();
    if (!text) {
      return Alert.alert("입력 필요", "영수증 텍스트를 붙여넣어 주세요.");
    }
    const res = parseReceiptFromText(text);
    setImageUri(null);
    setPasteOpen(false);
    applyOcrResult(res);
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

  const updateItem = (idx: number, patch: Partial<ReceiptItem>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
      };
    });
  };

  const removeItem = (idx: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.filter((_, i) => i !== idx) };
    });
  };

  const addItem = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: [...prev.items, { name: "", price: 0 }],
      };
    });
  };

  const recomputeTotal = () => {
    if (!draft) return;
    const sum = draft.items.reduce((s, it) => s + (it.price || 0), 0);
    updateDraft({ totalAmount: sum });
  };

  const onSave = async () => {
    if (!draft) return;
    if (!draft.storeName.trim()) {
      return Alert.alert("입력 확인", "가맹점명을 입력해주세요.");
    }
    if (draft.totalAmount <= 0) {
      return Alert.alert("입력 확인", "총 결제금액이 0원 이상이어야 합니다.");
    }
    setStep("saving");
    try {
      await saveTransaction("receipt", {
        ...draft,
        imageUri,
        userEditedCategory: draft.category !== draft.initialCategory,
      });
      Alert.alert("등록 완료", "가계부에 추가되었어요.", [
        {
          text: "확인",
          onPress: () => router.back(),
        },
      ]);
    } catch {
      Alert.alert("저장 실패", "잠시 후 다시 시도해주세요.");
      setStep("review");
    }
  };


  if (step === "idle" && !imageUri) {
    return (
      <>
        <EmptyState
          onPick={pickFromLibrary}
          onShoot={takePhoto}
          onPasteText={() => setPasteOpen(true)}
          ocrAvailable={ocrAvailable}
        />
        <PasteTextModal
          open={pasteOpen}
          value={pasteText}
          onChangeText={setPasteText}
          onClose={() => setPasteOpen(false)}
          onConfirm={startFromPastedText}
        />
      </>
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {CATEGORIES.map((c) => {
                const active = draft?.category === c.id;
                const isAi = draft?.initialCategory === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => updateDraft({ category: c.id })}
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
                    {isAi && !active && (
                      <View style={styles.aiDot} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {draft && draft.category !== draft.initialCategory && (
              <View style={styles.feedbackBox}>
                <Ionicons name="bulb-outline" size={14} color="#7C3AED" />
                <Text style={styles.feedbackText}>
                  수정한 분류({getCategory(draft.category).label})를 기억하고
                  같은 매장에 자동 적용해요.
                </Text>
              </View>
            )}
          </View>

          {/* 품목 */}
          <View style={styles.card}>
            <View style={styles.cardLabelRow}>
              <Text style={styles.cardLabel}>품목</Text>
              <TouchableOpacity
                onPress={recomputeTotal}
                style={styles.tinyBtn}
              >
                <Ionicons name="calculator-outline" size={12} color="#3B82F6" />
                <Text style={styles.tinyBtnText}>합계 다시 계산</Text>
              </TouchableOpacity>
            </View>
            {draft?.items.map((it, idx) => (
              <View key={idx} style={styles.itemRow}>
                <TextInput
                  style={[styles.input, styles.itemNameInput]}
                  value={it.name}
                  onChangeText={(v) => updateItem(idx, { name: v })}
                  placeholder="품목명"
                  placeholderTextColor="#9CA3AF"
                />
                <TextInput
                  style={[styles.input, styles.itemPriceInput]}
                  value={it.price ? String(it.price) : ""}
                  onChangeText={(v) =>
                    updateItem(idx, {
                      price: parseInt(v.replace(/[^0-9]/g, ""), 10) || 0,
                    })
                  }
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                />
                <TouchableOpacity
                  onPress={() => removeItem(idx)}
                  style={styles.removeBtn}
                >
                  <Ionicons name="close" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={addItem} style={styles.addItemBtn}>
              <Ionicons name="add" size={16} color="#3B82F6" />
              <Text style={styles.addItemText}>품목 추가</Text>
            </TouchableOpacity>
          </View>

          {/* 총액 */}
          <View style={[styles.card, styles.totalCard]}>
            <Text style={styles.totalLabel}>총 결제금액</Text>
            <TextInput
              style={styles.totalInput}
              value={draft ? String(draft.totalAmount) : ""}
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

          {/* 원본 텍스트 */}
          <TouchableOpacity
            onPress={() => setShowRaw((s) => !s)}
            style={styles.rawToggle}
          >
            <Ionicons
              name={showRaw ? "chevron-up" : "chevron-down"}
              size={16}
              color="#6B7280"
            />
            <Text style={styles.rawToggleText}>OCR 원본 텍스트 보기</Text>
          </TouchableOpacity>
          {showRaw && draft?.rawText && (
            <View style={styles.rawBox}>
              <Text style={styles.rawText}>{draft.rawText}</Text>
            </View>
          )}

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
  onPasteText,
  ocrAvailable,
}: {
  onPick: () => void;
  onShoot: () => void;
  onPasteText: () => void;
  ocrAvailable: boolean;
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

        <TouchableOpacity style={styles.bigGhost} onPress={onPasteText}>
          <Ionicons name="document-text-outline" size={18} color="#6B7280" />
          <Text style={styles.bigGhostText}>
            {ocrAvailable
              ? "텍스트로 등록 (사진 없이)"
              : "텍스트 붙여넣기로 등록"}
          </Text>
        </TouchableOpacity>

        <View style={styles.tipBox}>
          <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
          <Text style={styles.tipBoxText}>
            {ocrAvailable
              ? "영수증이 잘 나오게 평평하게 펴서 모서리가 모두 보이도록 찍어주세요."
              : "서버가 아직 연결되지 않았어요. 그동안은 '텍스트 붙여넣기'로 테스트할 수 있어요."}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PasteTextModal({
  open,
  value,
  onChangeText,
  onClose,
  onConfirm,
}: {
  open: boolean;
  value: string;
  onChangeText: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalCard}
        >
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>영수증 텍스트 붙여넣기</Text>
            <TouchableOpacity onPress={onClose} hitSlop={HITSLOP}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSub}>
            영수증/문자에 적혀 있는 텍스트를 그대로 붙여넣으면, 가맹점·금액·품목을
            자동으로 분리해 채워드려요.
          </Text>
          <TextInput
            multiline
            value={value}
            onChangeText={onChangeText}
            placeholder={
              "예)\n스타벅스 강남R점\n2026-04-29 18:42\n아메리카노 T  4,500\n카야토스트   4,500\n합계  9,000\n결제수단: 카드"
            }
            placeholderTextColor="#9CA3AF"
            style={styles.modalInput}
            textAlignVertical="top"
          />
          <TouchableOpacity onPress={onConfirm} style={styles.modalConfirm}>
            <Ionicons name="sparkles" size={16} color="#FFFFFF" />
            <Text style={styles.modalConfirmText}>분석해서 채우기</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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
