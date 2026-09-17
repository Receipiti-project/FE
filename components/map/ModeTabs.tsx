import { Mode, MODES } from "@/constants/mapConfig";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  mode: Mode;
  onChange: (mode: Mode) => void;
};

export default function ModeTabs({ mode, onChange }: Props) {
  return (
    <View style={styles.modeRow}>
      {MODES.map((m) => {
        const active = m.id === mode;
        return (
          <TouchableOpacity
            key={m.id}
            onPress={() => onChange(m.id)}
            style={[styles.modeChip, active && styles.modeChipActive]}
          >
            <Text
              style={[styles.modeChipText, active && styles.modeChipTextActive]}
            >
              {m.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  modeChipActive: { backgroundColor: "#FFFFFF" },
  modeChipText: { fontSize: 13, color: "#6B7280", fontWeight: "600" },
  modeChipTextActive: { color: "#111827", fontWeight: "700" },
});
