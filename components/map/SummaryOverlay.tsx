import { Mode } from "@/constants/mapConfig";
import { formatKRW } from "@/constants/mockData";
import { MapSummary } from "@/scripts/useMapData";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  mode: Mode;
  summary: MapSummary;
  zoneCount: number;
  rangeLabel: string;
};

export default function SummaryOverlay({
  mode,
  summary,
  zoneCount,
  rangeLabel,
}: Props) {
  return (
    <View style={styles.summaryOverlay}>
      {mode === "today" && (
        <>
          <View style={styles.summaryItem}>
            <Ionicons name="walk-outline" size={14} color="#3B82F6" />
            <Text style={styles.summaryText}>{summary.distanceKm}km</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Ionicons name="card-outline" size={14} color="#3B82F6" />
            <Text style={styles.summaryText}>
              {formatKRW(summary.dayTotal)}
            </Text>
          </View>
        </>
      )}
      {mode === "heatmap" && (
        <View style={styles.summaryItem}>
          <Ionicons name="flame" size={14} color="#F97316" />
          <Text style={styles.summaryText}>
            소비 {summary.visibleCount}건 · {rangeLabel}
          </Text>
        </View>
      )}
      {mode === "zones" && (
        <View style={styles.summaryItem}>
          <Ionicons name="location" size={14} color="#3B82F6" />
          <Text style={styles.summaryText}>생활권 {zoneCount}곳</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summaryOverlay: {
    position: "absolute",
    left: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 8,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  summaryItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  summaryText: { color: "#111827", fontSize: 12, fontWeight: "700" },
  summaryDivider: { width: 1, height: 12, backgroundColor: "#E5E7EB" },
});
