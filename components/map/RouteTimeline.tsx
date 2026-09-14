import { formatKRW, formatTime, getCategory } from "@/constants/mockData";
import { MapPin } from "@/scripts/useMapData";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  route: MapPin[];
  selectedId?: string | null;
  onSelect: (pin: MapPin) => void;
};

export default function RouteTimeline({ route, selectedId, onSelect }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>소비 동선</Text>
        <Text style={styles.metaTinyLabel}>총 {route.length}개 지점</Text>
      </View>
      <View style={styles.timeline}>
        {route.map((pin, idx) => {
          const cat = getCategory(pin.category);
          const isLast = idx === route.length - 1;
          const isActive = selectedId === pin.id;
          return (
            <Pressable
              key={pin.id}
              style={({ pressed }) => [
                styles.tlRow,
                pressed && { opacity: 0.6 },
              ]}
              onPress={() => onSelect(pin)}
            >
              <View style={styles.tlAxis}>
                <View
                  style={[
                    styles.tlDot,
                    { backgroundColor: cat.color },
                    isActive && styles.tlDotActive,
                  ]}
                >
                  <Text style={styles.tlDotNum}>{idx + 1}</Text>
                </View>
                {!isLast && <View style={styles.tlLine} />}
              </View>
              <View style={[styles.tlBody, isActive && styles.tlBodyActive]}>
                <View style={styles.tlHead}>
                  <Text style={styles.tlTime}>
                    {formatTime(pin.paymentDate)}
                  </Text>
                  <Text style={styles.tlAmount}>{formatKRW(pin.amount)}</Text>
                </View>
                <Text style={styles.tlStore}>{pin.storeName}</Text>
                <Text style={styles.tlAddr}>{pin.address}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  metaTinyLabel: { color: "#9CA3AF", fontSize: 11 },
  timeline: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  tlRow: { flexDirection: "row", gap: 12 },
  tlAxis: { width: 24, alignItems: "center" },
  tlDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  tlDotActive: {
    borderWidth: 2,
    borderColor: "#111827",
    transform: [{ scale: 1.1 }],
  },
  tlDotNum: { color: "#FFFFFF", fontWeight: "800", fontSize: 11 },
  tlLine: { width: 2, flex: 1, backgroundColor: "#E5E7EB", marginTop: 2 },
  tlBody: { flex: 1, paddingBottom: 16 },
  tlBodyActive: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    paddingHorizontal: 8,
    marginLeft: -8,
  },
  tlHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tlTime: { color: "#6B7280", fontSize: 12, fontWeight: "600" },
  tlAmount: { color: "#111827", fontWeight: "700", fontSize: 13 },
  tlStore: { color: "#111827", fontWeight: "600", fontSize: 14, marginTop: 2 },
  tlAddr: { color: "#9CA3AF", fontSize: 11, marginTop: 2 },
});
