import { formatKRW } from "@/constants/mockData";
import { MapZone } from "@/scripts/useMapData";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Circle, Marker } from "react-native-maps";

const SETTLE_MS = 1000;

type Props = {
  zones: MapZone[];
  showTags: boolean;
};

export default function ZoneLayer({ zones, showTags }: Props) {
  const [tracksChanges, setTracksChanges] = useState(true);
  const signature = `${zones
    .map((z) => `${z.id}:${z.color}`)
    .join(",")}|${showTags}`;

  useEffect(() => {
    setTracksChanges(true);
    const timer = setTimeout(() => setTracksChanges(false), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [signature]);

  return (
    <>
      {zones.map((zone) => {
        const center = {
          latitude: zone.latitude,
          longitude: zone.longitude,
        };

        return (
          <React.Fragment key={zone.id}>
            <Circle
              center={center}
              radius={zone.radiusMeters}
              strokeColor={zone.color}
              strokeWidth={3}
              fillColor={`${zone.color}45`}
            />
            <Marker
              coordinate={center}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={tracksChanges}
              title={zone.label}
              description={`${zone.role} · ${zone.visitCount}회 · ${formatKRW(
                zone.totalSpend
              )}`}
            >
              <View
                style={[
                  styles.zoneBadge,
                  { borderColor: zone.color },
                ]}
              >
                <View
                  style={[styles.zoneBadgeIcon, { backgroundColor: zone.color }]}
                >
                  <Ionicons name="location" size={11} color="#FFFFFF" />
                </View>
                <Text style={styles.zoneBadgeLabel} numberOfLines={1}>
                  {zone.label}
                </Text>
                {showTags && (
                  <Text style={[styles.zoneBadgeCount, { color: zone.color }]}>
                    {zone.visitCount}회
                  </Text>
                )}
              </View>
            </Marker>
          </React.Fragment>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  zoneBadge: {
    minWidth: 92,
    maxWidth: 170,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: "rgba(255,255,255,0.96)",
    shadowColor: "#111827",
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  zoneBadgeIcon: {
    width: 20,
    height: 20,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  zoneBadgeLabel: { flexShrink: 1, color: "#111827", fontSize: 11, fontWeight: "800" },
  zoneBadgeCount: { fontSize: 10, fontWeight: "800" },
});
