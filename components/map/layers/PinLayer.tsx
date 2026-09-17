import { getCategory } from "@/constants/mockData";
import { MapPin } from "@/scripts/useMapData";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";

const SETTLE_MS = 1000;

type Props = {
  pins: MapPin[];
  numbered: boolean;
  selectedId?: string | null;
  onSelect: (pin: MapPin) => void;
};

export default function PinLayer({
  pins,
  numbered,
  selectedId,
  onSelect,
}: Props) {
  const [tracksChanges, setTracksChanges] = useState(true);
  const signature = `${pins.map((p) => p.id).join(",")}|${numbered}|${selectedId ?? ""}`;

  useEffect(() => {
    setTracksChanges(true);
    const timer = setTimeout(() => setTracksChanges(false), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [signature]);

  return (
    <>
      {pins.map((pin, idx) => {
        const cat = getCategory(pin.category);
        const isActive = selectedId === pin.id;
        return (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            onPress={() => onSelect(pin)}
            tracksViewChanges={tracksChanges}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.pinBox}>
            <View
              style={[
                styles.pinDot,
                {
                  backgroundColor: cat.color,
                  transform: [{ scale: isActive ? 1.15 : 1 }],
                  borderColor: "#FFFFFF",
                  borderWidth: isActive ? 3 : 2,
                },
              ]}
            >
              {numbered ? (
                <Text style={styles.pinNum}>{idx + 1}</Text>
              ) : (
                <Ionicons name={cat.icon} size={12} color="#FFFFFF" />
              )}
            </View>
            </View>
          </Marker>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  pinBox: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  pinDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pinNum: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
});
