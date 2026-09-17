import { formatKRW } from "@/constants/mockData";
import { UnmappedExpense } from "@/scripts/useMapData";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  visible: boolean;
  items: UnmappedExpense[];
  onSelect: (item: UnmappedExpense) => void;
  onClose: () => void;
};

export default function UnmappedSheet({
  visible,
  items,
  onSelect,
  onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.grabber} />

          <Text style={styles.title}>위치 미지정 {items.length}건</Text>
          <Text style={styles.subtitle}>
            일부는 지도에 추정 위치로 표시돼요. 탭해서 장소를 지정하세요.
          </Text>

          {items.length === 0 && (
            <View style={styles.centerBox}>
              <Ionicons name="checkmark-circle" size={28} color="#10B981" />
              <Text style={styles.emptyText}>전부 지정됐어요</Text>
            </View>
          )}

          <ScrollView
            style={styles.list}
            contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
          >
            {items.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.6 },
                ]}
                onPress={() => onSelect(item)}
              >
                <View style={styles.iconSlot}>
                  <Ionicons name="help" size={15} color="#B45309" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowStore} numberOfLines={1}>
                    {item.storeName}
                  </Text>
                  <Text style={styles.rowDate}>
                    {Number(item.paymentDate.slice(5, 7))}월{" "}
                    {Number(item.paymentDate.slice(8, 10))}일
                  </Text>
                </View>
                <Text style={styles.rowAmount}>{formatKRW(item.amount)}</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: "72%",
  },
  grabber: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 12, color: "#9CA3AF", marginTop: 4, lineHeight: 17 },
  list: { marginTop: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
  },
  iconSlot: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  rowStore: { color: "#111827", fontSize: 14, fontWeight: "600" },
  rowDate: { color: "#9CA3AF", fontSize: 11, marginTop: 2 },
  rowAmount: { color: "#111827", fontSize: 14, fontWeight: "800" },
  centerBox: { alignItems: "center", gap: 8, paddingVertical: 32 },
  emptyText: { color: "#9CA3AF", fontSize: 13 },
});
