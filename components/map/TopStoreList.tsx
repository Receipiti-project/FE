import { formatKRW } from "@/constants/mockData";
import { TopStore } from "@/scripts/useMapData";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  stores: TopStore[];
  onSelect: (store: TopStore) => void;
};

export default function TopStoreList({ stores, onSelect }: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>자주 가는 매장</Text>
      <View style={styles.storeList}>
        {stores.map((s, i) => (
          <Pressable
            key={s.store}
            style={({ pressed }) => [
              styles.storeRow,
              i === stores.length - 1 && { borderBottomWidth: 0 },
              pressed && { opacity: 0.6 },
            ]}
            onPress={() => onSelect(s)}
          >
            <View style={styles.rankBadge}>
              <Ionicons name="location" size={14} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.storeName}>{s.store}</Text>
              <Text style={styles.storeMeta}>
                이번 달 {s.count}회 · 총 {formatKRW(s.total)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  storeList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    overflow: "hidden",
    marginTop: 12,
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  storeName: { color: "#111827", fontWeight: "600", fontSize: 14 },
  storeMeta: { color: "#9CA3AF", fontSize: 11, marginTop: 2 },
});
