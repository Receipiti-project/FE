import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
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
import {
  CATEGORIES,
  CategoryId,
  formatKRW,
  getCategory,
} from "@/constants/mockData";
import {
  ApiNotConfiguredError,
  CaptureOcrResult,
  CaptureSource,
  isServerOcrConfigured,
  OcrServerError,
  parseCapture,
  parseCaptureFromText,
  PaymentMethod,
  saveTransactions,
} from "@/services/ocr";

const HITSLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const;

type Step = "idle" | "analyzing" | "review" | "saving";

type DraftPayment = {
  id: string;
  store: string;
  amount: number;
  paidAt?: string;
  paidAtIso?: string;
  method: PaymentMethod;
  category: CategoryId;
  initialCategory: CategoryId;
  confidence: number;
  address?: string;
  include: boolean;
  expanded: boolean;
};

const ANALYSIS_STEPS = [
  { id: "upload", label: "이미지 업로드" },
  { id: "ocr", label: "OCR 텍스트 추출" },
  { id: "extract", label: "결제 항목 분리" },
  { id: "classify", label: "카테고리 자동 분류" },
];

const PAYMENT_METHODS: PaymentMethod[] = [
  "카드",
  "현금",
  "간편결제",
  "계좌이체",
];

const SOURCE_LABEL_MAP: Record<CaptureSource, { icon: keyof typeof Ionicons.glyphMap; tone: string }> = {
  kakao: { icon: "chatbubbles", tone: "#FACC15" },
  sms: { icon: "chatbox-ellipses", tone: "#3B82F6" },
  push: { icon: "notifications", tone: "#EF4444" },
  unknown: { icon: "image", tone: "#6B7280" },
};

export default function CaptureScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [analysisStep, setAnalysisStep] = useState(0);
  const [source, setSource] = useState<CaptureSource>("unknown");
  const [sourceLabel, setSourceLabel] = useState("");
  const [drafts, setDrafts] = useState<DraftPayment[]>([]);
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
    setStep("idle");
    setAnalysisStep(0);
    setDrafts([]);
    setSource("unknown");
    setSourceLabel("");
  };

  const applyOcrResult = (res: CaptureOcrResult) => {
    setSource(res.source);
    setSourceLabel(res.sourceLabel);
    setDrafts(
      res.payments.map((p, i) => ({
        id: `p_${i}`,
        store: p.store,
        amount: p.amount,
        paidAt: p.paidAt,
        paidAtIso: p.paidAtIso,
        method: p.method ?? "카드",
        category: p.category ?? "etc",
        initialCategory: p.category ?? "etc",
        confidence: p.confidence ?? 0.8,
        address: p.address,
        include: true,
        expanded: false,
      }))
    );
    setStep("review");
  };

  const startFlow = async (uri: string) => {
    setImageUri(uri);
    setDrafts([]);
    setStep("analyzing");
    setAnalysisStep(0);

    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setAnalysisStep((p) => Math.min(p + 1, ANALYSIS_STEPS.length - 1));
    }, 320);

    try {
      const res = await parseCapture(uri);
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      setAnalysisStep(ANALYSIS_STEPS.length - 1);
      if (res.payments.length === 0) {
        setImageUri(null);
        setStep("idle");
        Alert.alert(
          "결제 내역을 찾지 못했어요",
          "OCR로 결제 알림 형태를 인식하지 못했습니다. 텍스트를 직접 붙여넣어 등록할 수 있어요.",
          [
            { text: "닫기", style: "cancel" },
            { text: "텍스트 붙여넣기", onPress: () => setPasteOpen(true) },
          ]
        );
        return;
      }
      applyOcrResult(res);
    } catch (e) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      if (e instanceof ApiNotConfiguredError) {
        Alert.alert(
          "서버가 아직 연결되지 않았어요",
          "지금은 카톡 결제 메시지 텍스트를 직접 붙여넣어 분석해보시겠어요?",
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
      return Alert.alert("입력 필요", "결제 메시지 텍스트를 붙여넣어 주세요.");
    }
    const res = parseCaptureFromText(text);
    setImageUri(null);
    setPasteOpen(false);
    if (res.payments.length === 0) {
      return Alert.alert(
        "결제 내역을 찾지 못했어요",
        "메시지에서 금액·가맹점을 인식하지 못했습니다. 다른 메시지를 시도해보세요."
      );
    }
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

  const updateDraft = (id: string, patch: Partial<DraftPayment>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const toggleExpand = (id: string) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, expanded: !d.expanded } : d))
    );
  };

  const selectedDrafts = drafts.filter((d) => d.include);
  const selectedTotal = selectedDrafts.reduce((s, d) => s + d.amount, 0);

  const onSave = async () => {
    if (selectedDrafts.length === 0) {
      return Alert.alert("선택 필요", "등록할 결제를 1건 이상 선택해주세요.");
    }
    setStep("saving");
    try {
      await saveTransactions(
        "capture",
        selectedDrafts.map((d) => ({
          store: d.store,
          amount: d.amount,
          paidAt: d.paidAt,
          paidAtIso: d.paidAtIso,
          method: d.method,
          category: d.category,
          address: d.address,
          imageUri,
          source,
          userEditedCategory: d.category !== d.initialCategory,
        }))
      );
      Alert.alert(
        "등록 완료",
        `${selectedDrafts.length}건이 가계부에 추가되었어요.`,
        [{ text: "확인", onPress: () => router.back() }]
      );
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

  const sourceMeta = SOURCE_LABEL_MAP[source];

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
          <Text style={styles.topTitle}>캡처 검토</Text>
          <TouchableOpacity onPress={reset} style={styles.iconBtn} hitSlop={HITSLOP}>
            <Ionicons name="refresh" size={20} color="#111827" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 출처 카드 */}
          <View style={styles.sourceCard}>
            <View
              style={[
                styles.sourceIcon,
                { backgroundColor: `${sourceMeta.tone}1A` },
              ]}
            >
              <Ionicons
                name={sourceMeta.icon}
                size={20}
                color={sourceMeta.tone}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sourceTitle}>{sourceLabel || "캡처 이미지"}</Text>
              <Text style={styles.sourceMeta}>
                결제 {drafts.length}건 추출 · {selectedDrafts.length}건 선택됨
              </Text>
            </View>
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={11} color="#FFFFFF" />
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          </View>

          {/* 미리보기 + 다시 촬영 */}
          {imageUri && (
            <View style={styles.previewWrap}>
              <Image source={{ uri: imageUri }} style={styles.preview} />
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={pickFromLibrary}
              >
                <Ionicons name="image-outline" size={14} color="#FFFFFF" />
                <Text style={styles.retakeText}>다시 선택</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.helperRow}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color="#6B7280"
            />
            <Text style={styles.helperText}>
              체크된 항목만 가계부에 등록됩니다. 잘못 추출된 항목은 카드를
              눌러 수정할 수 있어요.
            </Text>
          </View>

          {/* 결제 카드 리스트 */}
          <View style={{ gap: 10, marginTop: 12 }}>
            {drafts.map((d) => (
              <PaymentCard
                key={d.id}
                draft={d}
                onToggleInclude={() =>
                  updateDraft(d.id, { include: !d.include })
                }
                onToggleExpand={() => toggleExpand(d.id)}
                onChange={(patch) => updateDraft(d.id, patch)}
                onRemove={() => removeDraft(d.id)}
              />
            ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* 하단 저장 바 */}
        <View style={styles.bottomBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bottomMeta}>
              선택 {selectedDrafts.length}건 · 합계
            </Text>
            <Text style={styles.bottomTotal}>{formatKRW(selectedTotal)}</Text>
          </View>
          <TouchableOpacity
            onPress={onSave}
            disabled={step === "saving" || selectedDrafts.length === 0}
            style={[
              styles.saveBtn,
              (step === "saving" || selectedDrafts.length === 0) && {
                opacity: 0.6,
              },
            ]}
          >
            {step === "saving" ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.saveBtnText}>
                  {selectedDrafts.length}건 등록
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PaymentCard({
  draft,
  onToggleInclude,
  onToggleExpand,
  onChange,
  onRemove,
}: {
  draft: DraftPayment;
  onToggleInclude: () => void;
  onToggleExpand: () => void;
  onChange: (patch: Partial<DraftPayment>) => void;
  onRemove: () => void;
}) {
  const cat = getCategory(draft.category);
  const conf = Math.round(draft.confidence * 100);
  const userEdited = draft.category !== draft.initialCategory;

  return (
    <View
      style={[
        styles.payCard,
        !draft.include && { opacity: 0.5 },
        draft.expanded && { borderColor: "#3B82F6" },
      ]}
    >
      <View style={styles.payHead}>
        <TouchableOpacity onPress={onToggleInclude} style={styles.checkbox}>
          {draft.include ? (
            <View style={styles.checkboxOn}>
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            </View>
          ) : (
            <View style={styles.checkboxOff} />
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={onToggleExpand} style={{ flex: 1 }}>
          <View style={styles.payRow}>
            <Text style={styles.payStore} numberOfLines={1}>
              {draft.store || "(가맹점명 없음)"}
            </Text>
            <Text style={styles.payAmount}>
              {formatKRW(draft.amount)}
            </Text>
          </View>
          <View style={styles.tagRow}>
            <View
              style={[
                styles.payTag,
                { backgroundColor: `${cat.color}1A` },
              ]}
            >
              <Ionicons name={cat.icon} size={11} color={cat.color} />
              <Text style={[styles.payTagText, { color: cat.color }]}>
                {cat.label}
              </Text>
              {userEdited && (
                <Ionicons name="pencil" size={9} color={cat.color} />
              )}
            </View>
            <View style={styles.payTag}>
              <Text style={styles.payTagText}>{draft.method}</Text>
            </View>
            <View
              style={[
                styles.payTag,
                {
                  backgroundColor: conf >= 90 ? "#ECFDF5" : "#FFF7ED",
                },
              ]}
            >
              <Text
                style={[
                  styles.payTagText,
                  { color: conf >= 90 ? "#059669" : "#D97706" },
                ]}
              >
                신뢰도 {conf}%
              </Text>
            </View>
            {draft.paidAt && (
              <Text style={styles.payTime}>{draft.paidAt}</Text>
            )}
          </View>
          {draft.address && (
            <View style={styles.addrRow}>
              <Ionicons name="location-outline" size={12} color="#9CA3AF" />
              <Text style={styles.addrText}>{draft.address}</Text>
            </View>
          )}
        </TouchableOpacity>

        <Ionicons
          name={draft.expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color="#9CA3AF"
        />
      </View>

      {draft.expanded && (
        <View style={styles.expandBody}>
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.fieldLabel}>가맹점명</Text>
            <TextInput
              style={styles.input}
              value={draft.store}
              onChangeText={(v) => onChange({ store: v })}
              placeholder="가맹점명"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.fieldLabel}>금액</Text>
            <TextInput
              style={styles.input}
              value={String(draft.amount)}
              onChangeText={(v) =>
                onChange({
                  amount: parseInt(v.replace(/[^0-9]/g, ""), 10) || 0,
                })
              }
              keyboardType="number-pad"
              placeholder="0"
            />
          </View>
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.fieldLabel}>결제수단</Text>
            <View style={styles.chipRow}>
              {PAYMENT_METHODS.map((m) => {
                const active = draft.method === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => onChange({ method: m })}
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
          <View>
            <Text style={styles.fieldLabel}>카테고리</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6 }}
            >
              {CATEGORIES.map((c) => {
                const active = draft.category === c.id;
                const isAi = draft.initialCategory === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => onChange({ category: c.id })}
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
                      size={12}
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
                    {isAi && !active && <View style={styles.aiDot} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
          <TouchableOpacity onPress={onRemove} style={styles.removeRow}>
            <Ionicons name="trash-outline" size={14} color="#EF4444" />
            <Text style={styles.removeText}>이 결제 삭제</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function EmptyState({
  onPick,
  onPasteText,
  ocrAvailable,
}: {
  onPick: () => void;
  onPasteText: () => void;
  ocrAvailable: boolean;
}) {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={HITSLOP}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>캡처로 등록</Text>
        <View style={styles.iconBtn} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.emptyTitle}>
          카톡 결제 알림 캡처를 자동 분석
        </Text>
        <Text style={styles.emptySub}>
          신한·KB·삼성카드 같은 카드사 알림과 카카오페이·토스 알림을 OCR로 읽어
          가맹점·금액·일시·결제수단을 한 번에 정리합니다. 한 캡처에 결제가 여러
          건 있어도 자동으로 분리해드려요.
        </Text>
        <View style={styles.featureRow}>
          {[
            { icon: "chatbubbles-outline", label: "카톡/문자" },
            { icon: "documents-outline", label: "다건 분리" },
            { icon: "sparkles-outline", label: "AI 분류" },
          ].map((f) => (
            <View key={f.label} style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Ionicons name={f.icon as any} size={18} color="#7C3AED" />
              </View>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.bigPrimary} onPress={onPick}>
          <Ionicons name="images-outline" size={20} color="#FFFFFF" />
          <Text style={styles.bigPrimaryText}>앨범에서 선택</Text>
        </TouchableOpacity>

        {/* 폴백 — 백엔드 OCR 미연결 상태에서도 텍스트로 등록 가능 */}
        <TouchableOpacity style={styles.bigGhost} onPress={onPasteText}>
          <Ionicons name="document-text-outline" size={18} color="#6B7280" />
          <Text style={styles.bigGhostText}>
            {ocrAvailable
              ? "메시지 텍스트로 등록 (사진 없이)"
              : "메시지 텍스트 붙여넣기로 등록"}
          </Text>
        </TouchableOpacity>

        <View style={styles.tipBox}>
          <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
          <Text style={styles.tipBoxText}>
            {ocrAvailable
              ? "긴 캡처는 결제 내역 부분만 잘라서 올리면 정확도가 올라가요."
              : "서버가 아직 연결되지 않았어요. 그동안은 '메시지 텍스트 붙여넣기'로 실제 카톡 메시지를 분석해볼 수 있어요."}
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
            <Text style={styles.modalTitle}>결제 메시지 붙여넣기</Text>
            <TouchableOpacity onPress={onClose} hitSlop={HITSLOP}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSub}>
            카톡으로 받은 카드사·페이 결제 알림을 그대로 붙여넣으면, 결제 N건을
            자동으로 분리·등록 후보로 만들어드려요.
          </Text>
          <TextInput
            multiline
            value={value}
            onChangeText={onChangeText}
            placeholder={
              "예)\n[Web발신]\n신한카드 승인\n홍*동님\n12,500원 일시불\n05/11 14:32\n스타벅스 강남R점\n누적 257,300원"
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
            <Image source={{ uri: imageUri }} style={styles.analyzePreview} />
            <View style={styles.scanlineOverlay}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          </View>
        )}
        <Text style={styles.analyzeHeading}>이미지를 분석하고 있어요</Text>
        <Text style={styles.analyzeSub}>OCR + AI 파싱이 진행됩니다</Text>
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
                      backgroundColor: "#7C3AED",
                      borderColor: "#7C3AED",
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
                    (done || active) && {
                      color: "#111827",
                      fontWeight: "700",
                    },
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
  sourceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  sourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceTitle: { color: "#111827", fontWeight: "700", fontSize: 14 },
  sourceMeta: { color: "#6B7280", fontSize: 12, marginTop: 2 },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  aiBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  previewWrap: {
    position: "relative",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    marginTop: 12,
  },
  preview: { width: "100%", height: 200, resizeMode: "contain" },
  retakeBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(17,24,39,0.85)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  retakeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  helperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  helperText: { color: "#6B7280", fontSize: 11, flex: 1, lineHeight: 16 },
  payCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#F3F4F6",
    overflow: "hidden",
  },
  payHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  checkbox: { width: 24, height: 24 },
  checkboxOn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOff: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
  },
  payRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  payStore: { color: "#111827", fontWeight: "700", fontSize: 14, flex: 1 },
  payAmount: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 16,
    marginLeft: 8,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
    alignItems: "center",
  },
  payTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  payTagText: { color: "#374151", fontSize: 11, fontWeight: "600" },
  payTime: { color: "#9CA3AF", fontSize: 11, marginLeft: 4 },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  addrText: { color: "#9CA3AF", fontSize: 11 },
  expandBody: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    backgroundColor: "#F9FAFB",
  },
  fieldLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipActive: { backgroundColor: "#EFF6FF", borderColor: "#3B82F6" },
  chipText: { color: "#6B7280", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#3B82F6", fontWeight: "700" },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  catChipText: { color: "#6B7280", fontSize: 12, fontWeight: "600" },
  aiDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#7C3AED",
  },
  removeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  removeText: { color: "#EF4444", fontSize: 12, fontWeight: "700" },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 12,
  },
  bottomMeta: { color: "#6B7280", fontSize: 11 },
  bottomTotal: { color: "#111827", fontSize: 18, fontWeight: "800" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  saveBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  /* empty */
  emptyTitle: { fontSize: 22, fontWeight: "800", color: "#111827", marginTop: 8 },
  emptySub: { color: "#6B7280", fontSize: 13, lineHeight: 20, marginTop: 8 },
  featureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  featureItem: { alignItems: "center", flex: 1 },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  featureLabel: { color: "#374151", fontSize: 12, fontWeight: "600" },
  bigPrimary: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#7C3AED",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  bigPrimaryText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  bigSecondary: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#F5F3FF",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  bigSecondaryText: { color: "#7C3AED", fontWeight: "800", fontSize: 15 },
  tipBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  tipBoxText: { color: "#6B7280", fontSize: 12, lineHeight: 18, flex: 1 },
  /* analyzing */
  analyzePreviewWrap: {
    width: "70%",
    aspectRatio: 0.8,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
    marginTop: 8,
  },
  analyzePreview: { width: "100%", height: "100%", resizeMode: "cover" },
  scanlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(124,58,237,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  analyzeHeading: {
    marginTop: 20,
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  analyzeSub: { color: "#9CA3AF", fontSize: 12, marginTop: 4 },
  stepList: { width: "100%", marginTop: 20, gap: 12 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  stepBadgeNum: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },
  stepLabel: { color: "#9CA3AF", fontSize: 14 },

  /* 텍스트 붙여넣기 진입 */
  bigGhost: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  bigGhostText: { color: "#374151", fontWeight: "700", fontSize: 14 },

  /* 텍스트 붙여넣기 모달 */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  modalHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  modalSub: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  modalInput: {
    marginTop: 14,
    minHeight: 200,
    maxHeight: 280,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: "#111827",
    backgroundColor: "#F9FAFB",
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
  modalConfirm: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    backgroundColor: "#7C3AED",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
});
