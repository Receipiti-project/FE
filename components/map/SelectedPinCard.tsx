import { formatKRW, formatTime, getCategory } from "@/constants/mockData";
import { MapPin } from "@/scripts/useMapData";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  pin: MapPin;
  onEditLocation: (pin: MapPin) => void;
};

export default function SelectedPinCard({ pin, onEditLocation }: Props) {
  const cat = getCategory(pin.category);

  return (
    <View style={styles.detailCard}>
      <View style={styles.detailRow}>
        <View
          style={[styles.detailIcon, { backgroundColor: `${cat.color}1A` }]}
        >
          <Ionicons name={cat.icon} size={20} color={cat.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.detailStore}>{pin.storeName}</Text>
          <Text style={styles.detailMeta}>
            {formatTime(pin.paymentDate)}
            {pin.address ? ` · ${pin.address}` : ""}
          </Text>
          {pin.memo && <Text style={styles.detailMemo}>{pin.memo}</Text>}
        </View>
        <Text style={styles.detailAmount}>{formatKRW(pin.amount)}</Text>
      </View>

      <TouchableOpacity
        style={styles.editBtn}
        onPress={() => onEditLocation(pin)}
      >
        <Ionicons name="location-outline" size={14} color="#3B82F6" />
        <Text style={styles.editBtnText}>위치 수정</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  detailCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    gap: 12,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
  },
  editBtnText: { color: "#3B82F6", fontSize: 12, fontWeight: "700" },
  detailIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  detailStore: { color: "#111827", fontWeight: "700", fontSize: 14 },
  detailMeta: { color: "#9CA3AF", fontSize: 11, marginTop: 2 },
  detailMemo: { color: "#6B7280", fontSize: 12, marginTop: 4 },
  detailAmount: { color: "#111827", fontWeight: "800", fontSize: 14 },
});
