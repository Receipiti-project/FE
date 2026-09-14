import { ROUTE_COLOR } from "@/constants/mapConfig";
import { bearingDeg, midPoint } from "@/scripts/mapGeo";
import { MapPin } from "@/scripts/useMapData";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { View } from "react-native";
import { Marker, Polyline } from "react-native-maps";

type Props = { route: MapPin[] };

export default function RouteLayer({ route }: Props) {
  if (route.length < 2) return null;

  return (
    <>
      <Polyline
        coordinates={route.map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
        }))}
        strokeColor={ROUTE_COLOR}
        strokeWidth={3}
      />
      {route.slice(0, -1).map((from, idx) => {
        const to = route[idx + 1];
        const mid = midPoint(from, to);
        const bearing = bearingDeg(from, to);
        return (
          <Marker
            key={`arrow-${from.id}-${to.id}`}
            coordinate={mid}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={{ transform: [{ rotate: `${bearing}deg` }] }}>
              <Ionicons name="caret-up" size={22} color={ROUTE_COLOR} />
            </View>
          </Marker>
        );
      })}
    </>
  );
}
