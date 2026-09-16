import { PropsWithChildren, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, PanResponder, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCategoryByName } from "@/constants/mockData";
import { useCategories } from "@/contexts/CategoryContext";
import { styles } from "@/styles/categoryStyles";

const CATEGORY_ROW_HEIGHT = 64;

type DraggableCategoryRowProps = PropsWithChildren<{
  index: number;
  total: number;
  onDragStateChange: (dragging: boolean) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}>;

function DraggableCategoryRow({
  children,
  index,
  total,
  onDragStateChange,
  onReorder,
}: DraggableCategoryRowProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const targetIndexRef = useRef(index);
  const [dragging, setDragging] = useState(false);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      targetIndexRef.current = index;
      setDragging(true);
      onDragStateChange(true);
    },
    onPanResponderMove: (_event, gesture) => {
      const minimum = -index * CATEGORY_ROW_HEIGHT;
      const maximum = (total - index - 1) * CATEGORY_ROW_HEIGHT;
      const offset = Math.max(minimum, Math.min(maximum, gesture.dy));
      translateY.setValue(offset);
      targetIndexRef.current = Math.max(
        0,
        Math.min(total - 1, index + Math.round(offset / CATEGORY_ROW_HEIGHT))
      );
    },
    onPanResponderRelease: () => {
      const targetIndex = targetIndexRef.current;
      Animated.timing(translateY, {
        toValue: (targetIndex - index) * CATEGORY_ROW_HEIGHT,
        duration: 120,
        useNativeDriver: true,
      }).start(() => {
        translateY.setValue(0);
        if (targetIndex !== index) onReorder(index, targetIndex);
        setDragging(false);
        onDragStateChange(false);
      });
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
      setDragging(false);
      onDragStateChange(false);
    },
  }), [index, onDragStateChange, onReorder, total, translateY]);

  return (
    <Animated.View
      style={[
        styles.row,
        dragging && styles.draggingRow,
        { transform: [{ translateY }] },
      ]}
    >
      {children}
      <View
        style={styles.dragHandle}
        accessibilityRole="adjustable"
        accessibilityLabel="카테고리 순서 변경"
        {...panResponder.panHandlers}
      >
        <Ionicons name="reorder-three-outline" size={24} color={dragging ? "#2563EB" : "#9CA3AF"} />
      </View>
    </Animated.View>
  );
}

export default function CategoriesScreen() {
  const { categories, loading, error, refetch, addCategory, renameCategory, removeCategory, reorderCategories } = useCategories();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const reordered = [...categories];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    reorderCategories(reordered.map((category) => category.categoryId));
  };

  const run = async (action: () => Promise<void>) => {
    setSaving(true);
    try {
      await action();
    } catch (e) {
      Alert.alert("카테고리 처리 실패", (e as Error)?.message ?? "다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return Alert.alert("입력 확인", "카테고리 이름을 입력해주세요.");
    void run(async () => {
      await addCategory(trimmed);
      setName("");
    });
  };

  const handleDelete = (id: number, categoryName: string) => {
    Alert.alert("카테고리 삭제", `${categoryName} 카테고리를 삭제할까요?`, [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => void run(() => removeCategory(id)) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>카테고리 관리</Text>
        <Pressable
          style={styles.headerButton}
          onPress={() => void refetch()}
          disabled={loading}
          hitSlop={12}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#3B82F6" />
          ) : (
            <Ionicons name="refresh" size={20} color="#374151" />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!dragging}
      >
        <Text style={styles.sectionTitle}>새 카테고리</Text>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="카테고리 이름"
            placeholderTextColor="#9CA3AF"
            maxLength={50}
            editable={!saving}
          />
          <Pressable style={styles.addButton} onPress={handleAdd} disabled={saving}>
            <Text style={styles.addButtonText}>추가</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>전체 카테고리</Text>
        <View style={styles.dragHint}>
          <Ionicons name="reorder-three-outline" size={18} color="#6B7280" />
          <Text style={styles.dragHintText}>오른쪽 핸들을 끌어 표시 순서를 변경할 수 있어요.</Text>
        </View>
        {error && categories.length > 0 && (
          <Pressable style={styles.errorBanner} onPress={() => void refetch()}>
            <Ionicons name="alert-circle-outline" size={17} color="#B45309" />
            <Text style={styles.errorBannerText} numberOfLines={2}>{error}</Text>
            <Text style={styles.errorBannerRetry}>재조회</Text>
          </Pressable>
        )}
        {loading && categories.length === 0 ? (
          <View style={styles.state}>
            <ActivityIndicator color="#3B82F6" />
            <Text style={styles.stateText}>카테고리를 불러오는 중이에요.</Text>
          </View>
        ) : error && categories.length === 0 ? (
          <Pressable style={styles.state} onPress={() => void refetch()}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        ) : categories.length === 0 ? (
          <View style={styles.state}>
            <Text style={styles.stateText}>등록된 카테고리가 없어요.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {categories.map((category, index) => {
              const editing = editingId === category.categoryId;
              const visual = getCategoryByName(category.name);
              return (
                <DraggableCategoryRow
                  key={category.categoryId}
                  index={index}
                  total={categories.length}
                  onDragStateChange={setDragging}
                  onReorder={handleReorder}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: `${visual.color}1A` }]}>
                    <Ionicons name={visual.icon} size={18} color={visual.color} />
                  </View>
                  {editing ? (
                    <TextInput style={styles.editInput} value={editingName} onChangeText={setEditingName} autoFocus maxLength={50} />
                  ) : (
                    <View style={styles.categoryText}>
                      <Text style={styles.categoryName}>{category.name}</Text>
                      <Text style={styles.categoryType}>{category.custom ? "사용자 카테고리" : "기본 카테고리"}</Text>
                    </View>
                  )}
                  {category.custom && (editing ? (
                    <>
                      <Pressable onPress={() => setEditingId(null)} hitSlop={8}>
                        <Ionicons name="close" size={20} color="#6B7280" />
                      </Pressable>
                      <Pressable
                        onPress={() => void run(async () => {
                          const trimmed = editingName.trim();
                          if (!trimmed) throw new Error("카테고리 이름을 입력해주세요.");
                          await renameCategory(category.categoryId, trimmed);
                          setEditingId(null);
                        })}
                        hitSlop={8}
                      >
                        <Ionicons name="checkmark" size={22} color="#2563EB" />
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable onPress={() => { setEditingId(category.categoryId); setEditingName(category.name); }} hitSlop={8}>
                        <Ionicons name="pencil-outline" size={19} color="#6B7280" />
                      </Pressable>
                      <Pressable onPress={() => handleDelete(category.categoryId, category.name)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={19} color="#EF4444" />
                      </Pressable>
                    </>
                  ))}
                </DraggableCategoryRow>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
