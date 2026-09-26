import { formatKRW } from "@/constants/mockData";
import { MapZone } from "@/scripts/useMapData";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
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
            {showTags && (
              <Marker
                coordinate={center}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={tracksChanges}
                title={zone.label}
                description={`${zone.role} · ${zone.visitCount}회 · ${formatKRW(
                  zone.totalSpend
                )}`}
              >
                <View style={styles.dotBox}>
                  <View style={[styles.zoneDot, { borderColor: zone.color }]} />
                </View>
              </Marker>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  dotBox: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  zoneDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 4,
    backgroundColor: "#FFFFFF",
  },
});
