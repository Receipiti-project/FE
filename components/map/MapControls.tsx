import { getLocationHint } from "@/scripts/currentLocation";
import { Ionicons } from "@expo/vector-icons";
import React, { RefObject, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import MapView from "react-native-maps";

const MY_LOCATION_DELTA = 0.01;

type Props = { mapRef: RefObject<MapView | null> };

export default function MapControls({ mapRef }: Props) {
  const [locating, setLocating] = useState(false);

  const zoomBy = async (delta: number) => {
    const cam = await mapRef.current?.getCamera();
    if (cam) {
      mapRef.current?.animateCamera({ ...cam, zoom: (cam.zoom ?? 14) + delta });
    }
  };

  const goToMyLocation = async () => {
    setLocating(true);
    try {
      const here = await getLocationHint();
      if (!here) {
        Alert.alert(
          "현재 위치를 가져올 수 없어요",
          "위치 권한을 확인해주세요."
        );
        return;
      }
      mapRef.current?.animateToRegion(
        {
          latitude: here.latitude,
          longitude: here.longitude,
          latitudeDelta: MY_LOCATION_DELTA,
          longitudeDelta: MY_LOCATION_DELTA,
        },
        500
      );
    } finally {
      setLocating(false);
    }
  };

  return (
    <>
      <View style={styles.zoomCol}>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => zoomBy(1)}>
          <Ionicons name="add" size={18} color="#374151" />
        </TouchableOpacity>
        <View style={styles.zoomDivider} />
        <TouchableOpacity style={styles.zoomBtn} onPress={() => zoomBy(-1)}>
          <Ionicons name="remove" size={18} color="#374151" />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.locateBtn}
        onPress={goToMyLocation}
        disabled={locating}
      >
        {locating ? (
          <ActivityIndicator size="small" color="#3B82F6" />
        ) : (
          <Ionicons name="locate" size={18} color="#3B82F6" />
        )}
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  zoomCol: {
    position: "absolute",
    right: 12,
    top: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  zoomBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomDivider: { height: 1, backgroundColor: "#F3F4F6" },
  locateBtn: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
});
