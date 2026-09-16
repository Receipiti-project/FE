import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCategories } from "@/contexts/CategoryContext";
import { getCategoryByName } from "@/constants/mockData";

type CategoryPickerProps = {
  selectedId: number | null;
  onSelect: (categoryId: number) => void;
  recommendedCategoryId?: number | null;
  compact?: boolean;
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("ko-KR");
}

export function CategoryPicker({
  selectedId,
  onSelect,
  recommendedCategoryId,
  compact = false,
}: CategoryPickerProps) {
  const { categories, loading, error, refetch, addCategory } = useCategories();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const normalizedQuery = normalize(query);
  const initialLoading = loading && categories.length === 0;
  const initialError = Boolean(error) && categories.length === 0;

  const filtered = useMemo(() => {
    if (!normalizedQuery) return categories;
    return categories.filter((category) =>
      normalize(category.name).includes(normalizedQuery)
    );
  }, [categories, normalizedQuery]);

  const exactMatch = useMemo(
    () => categories.find((category) => normalize(category.name) === normalizedQuery),
    [categories, normalizedQuery]
  );

  const createAndSelect = async () => {
    const name = query.trim();
    if (!name) return;
    if (exactMatch) {
      onSelect(exactMatch.categoryId);
      setQuery("");
      return;
    }

    setCreating(true);
    try {
      const created = await addCategory(name);
      onSelect(created.categoryId);
      setQuery("");
    } catch (error) {
      Alert.alert(
        "카테고리 생성 실패",
        (error as Error)?.message ?? "잠시 후 다시 시도해주세요."
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="카테고리 검색 또는 새 이름 입력"
          placeholderTextColor="#9CA3AF"
          editable={!creating && !initialLoading && !initialError}
          maxLength={50}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (exactMatch) {
              onSelect(exactMatch.categoryId);
              setQuery("");
            } else if (normalizedQuery) {
              void createAndSelect();
            }
          }}
          style={styles.searchInput}
        />
      </View>

      {initialLoading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.stateText}>카테고리를 불러오는 중이에요.</Text>
        </View>
      ) : initialError ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => void refetch()}
          style={[styles.stateBox, styles.errorBox]}
        >
          <Ionicons name="alert-circle-outline" size={17} color="#DC2626" />
          <View style={styles.stateCopy}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.retryText}>눌러서 다시 불러오기</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <>
          {error && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void refetch()}
              style={styles.warningBox}
            >
              <Ionicons name="alert-circle-outline" size={15} color="#B45309" />
              <Text style={styles.warningText} numberOfLines={2}>{error}</Text>
              <Text style={styles.warningRetry}>재조회</Text>
            </TouchableOpacity>
          )}
          {loading && (
            <View style={styles.refreshingRow}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.refreshingText}>목록 갱신 중</Text>
            </View>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chipRow}
          >
            {filtered.map((category) => {
              const visual = getCategoryByName(category.name);
              const active = selectedId === category.categoryId;
              const recommended = recommendedCategoryId === category.categoryId;
              return (
                <TouchableOpacity
                  key={category.categoryId}
                  onPress={() => onSelect(category.categoryId)}
                  style={[
                    styles.chip,
                    compact && styles.chipCompact,
                    active && {
                      backgroundColor: `${visual.color}1A`,
                      borderColor: visual.color,
                    },
                  ]}
                >
                  <Ionicons
                    name={visual.icon}
                    size={compact ? 12 : 14}
                    color={active ? visual.color : "#6B7280"}
                  />
                  <Text style={[styles.chipText, active && { color: visual.color }]}>
                    {category.name}
                  </Text>
                  {recommended && !active && <View style={styles.aiDot} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {categories.length === 0 && !normalizedQuery && (
            <Text style={styles.emptyText}>등록된 카테고리가 없어요.</Text>
          )}
        </>
      )}

      {!initialLoading && !initialError && !!normalizedQuery && !exactMatch && (
        <TouchableOpacity
          onPress={() => void createAndSelect()}
          disabled={creating}
          style={styles.createButton}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <Ionicons name="add-circle-outline" size={16} color="#2563EB" />
          )}
          <View style={styles.createCopy}>
            <Text style={styles.createText}>“{query.trim()}” 새 카테고리 만들기</Text>
            {filtered.length === 0 && (
              <Text style={styles.hint}>일치하는 카테고리가 없어 새로 생성합니다.</Text>
            )}
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  searchInput: { flex: 1, paddingVertical: 9, color: "#111827", fontSize: 13 },
  chipRow: { gap: 8, paddingRight: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipCompact: { paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { color: "#6B7280", fontSize: 12, fontWeight: "600" },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#93C5FD",
    backgroundColor: "#EFF6FF",
  },
  createCopy: { flex: 1 },
  createText: { color: "#2563EB", fontSize: 12, fontWeight: "700" },
  aiDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#7C3AED" },
  hint: { color: "#6B7280", fontSize: 10, lineHeight: 14, marginTop: 2 },
  stateBox: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
  },
  stateCopy: { flex: 1 },
  stateText: { color: "#6B7280", fontSize: 12 },
  errorBox: {
    justifyContent: "flex-start",
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  errorText: { color: "#B91C1C", fontSize: 11, lineHeight: 16 },
  retryText: { marginTop: 2, color: "#2563EB", fontSize: 11, fontWeight: "700" },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
  },
  warningText: { flex: 1, color: "#92400E", fontSize: 10, lineHeight: 14 },
  warningRetry: { color: "#2563EB", fontSize: 10, fontWeight: "800" },
  refreshingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  refreshingText: { color: "#6B7280", fontSize: 10 },
  emptyText: { color: "#9CA3AF", fontSize: 11, textAlign: "center", paddingVertical: 8 },
});
