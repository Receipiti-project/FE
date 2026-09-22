import { formatKRW } from "@/constants/mockData";
import { MapZone } from "@/scripts/useMapData";
import { Ionicons } from "@expo/vector-icons";
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
        {zones.length === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="location-outline" size={20} color="#6B7280" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyTitle}>아직 형성된 생활권이 없어요</Text>
              <Text style={styles.emptyDescription}>
                같은 지역 반경 600m 안에서 2회 이상 소비하면 생활권으로 표시됩니다.
              </Text>
            </View>
          </View>
        )}
        {zones.map((zone) => (
          <Pressable
            key={zone.id}
            style={({ pressed }) => [
              styles.zoneDetailCard,
              { borderColor: `${zone.color}55` },
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => onSelect(zone)}
          >
            <View style={[styles.zoneDetailIcon, { backgroundColor: `${zone.color}18` }]}>
              <Ionicons name="location" size={18} color={zone.color} />
            </View>
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
    borderWidth: 1.5,
    borderColor: "#F3F4F6",
    gap: 12,
  },
  zoneDetailIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
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
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: "#111827", fontSize: 13, fontWeight: "700" },
  emptyDescription: { color: "#6B7280", fontSize: 11, lineHeight: 17, marginTop: 3 },
});
