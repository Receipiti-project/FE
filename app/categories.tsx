import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCategories } from "@/contexts/CategoryContext";
import { styles } from "@/styles/categoryStyles";

export default function CategoriesScreen() {
  const { categories, loading, error, refetch, addCategory, renameCategory, removeCategory } = useCategories();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [saving, setSaving] = useState(false);

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

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
            {categories.map((category) => {
              const editing = editingId === category.categoryId;
              return (
                <View key={category.categoryId} style={styles.row}>
                  <View style={styles.categoryIcon}>
                    <Ionicons name={category.custom ? "pricetag-outline" : "folder-outline"} size={18} color="#3B82F6" />
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
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
