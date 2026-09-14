import { TIME_RANGES, TimeRangeId } from "@/constants/mapConfig";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  timeRange: TimeRangeId;
  onChange: (id: TimeRangeId) => void;
};

export default function TimeRangeFilter({ timeRange, onChange }: Props) {
  return (
    <View style={styles.timeRow}>
      <Ionicons name="time-outline" size={14} color="#6B7280" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingRight: 8 }}
      >
        {TIME_RANGES.map((r) => {
          const active = r.id === timeRange;
          return (
            <TouchableOpacity
              key={r.id}
              onPress={() => onChange(r.id)}
              style={[styles.timeChip, active && styles.timeChipActive]}
            >
              <Text
                style={[
                  styles.timeChipText,
                  active && styles.timeChipTextActive,
                ]}
              >
                {r.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.tzPill}>
        <Ionicons name="globe-outline" size={11} color="#374151" />
        <Text style={styles.tzText}>KST</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  timeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  timeChipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  timeChipText: { color: "#6B7280", fontSize: 12, fontWeight: "600" },
  timeChipTextActive: { color: "#FFFFFF" },
  tzPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  tzText: { color: "#374151", fontSize: 10, fontWeight: "700" },
});
