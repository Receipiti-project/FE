import { HEATMAP_GRADIENT } from "@/constants/mapConfig";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function HeatLegend() {
  return (
    <View style={styles.legend}>
      <Text style={styles.label}>적게 씀</Text>
      <View style={styles.bar}>
        {HEATMAP_GRADIENT.colors.map((color) => (
          <View key={color} style={[styles.segment, { backgroundColor: color }]} />
        ))}
      </View>
      <Text style={styles.label}>많이 씀</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    position: "absolute",
    left: 12,
    bottom: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  bar: {
    flexDirection: "row",
    width: 64,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  segment: { flex: 1 },
  label: { color: "#6B7280", fontSize: 10, fontWeight: "700" },
});
