import { formatKRW } from "@/constants/mockData";
import { MapZone } from "@/scripts/useMapData";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  zones: MapZone[];
  onSelect: (zone: MapZone) => void;
};

export default function ZoneList({ zones, onSelect }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>나의 소비 생활권</Text>
        <Text style={styles.metaTinyLabel}>반경 기준 자동 그룹핑</Text>
      </View>
      <View style={{ gap: 10 }}>
        {zones.map((zone) => (
          <Pressable
            key={zone.id}
            style={({ pressed }) => [
              styles.zoneDetailCard,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => onSelect(zone)}
          >
            <View
              style={[styles.zoneDetailDot, { backgroundColor: zone.color }]}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.zoneDetailHead}>
                <Text style={styles.zoneDetailLabel}>{zone.label}</Text>
                <Text style={styles.zoneDetailRole}>{zone.role}</Text>
              </View>
              <Text style={styles.zoneDetailMeta}>
                이번 달 {zone.visitCount}회 방문 · 반경 {zone.radiusMeters}m
              </Text>
            </View>
            <Text style={styles.zoneDetailAmount}>
              {formatKRW(zone.totalSpend)}
            </Text>
          </Pressable>
        ))}
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
  zoneDetailCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    gap: 12,
  },
  zoneDetailDot: { width: 10, height: 10, borderRadius: 5 },
  zoneDetailHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  zoneDetailLabel: { color: "#111827", fontWeight: "700", fontSize: 14 },
  zoneDetailRole: {
    color: "#6B7280",
    fontSize: 11,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
  zoneDetailMeta: { color: "#9CA3AF", fontSize: 11, marginTop: 4 },
  zoneDetailAmount: { color: "#111827", fontWeight: "800", fontSize: 14 },
});
