import {
  INITIAL_REGION,
  Mode,
  ZONE_LABEL_ZOOM_THRESHOLD,
} from "@/constants/mapConfig";
import { HeatPoint, MapPin, MapZone } from "@/scripts/useMapData";
import React, { forwardRef, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { PROVIDER_GOOGLE, Region } from "react-native-maps";
import HeatmapLayer from "./layers/HeatmapLayer";
import PinLayer from "./layers/PinLayer";
import RouteLayer from "./layers/RouteLayer";
import ZoneLayer from "./layers/ZoneLayer";

type Props = {
  mode: Mode;
  pins: MapPin[];
  route: MapPin[];
  zones: MapZone[];
  heatmapPoints: HeatPoint[];
  selectedId?: string | null;
  onSelectPin: (pin: MapPin) => void;
  layerRemountKey: string;
  children?: React.ReactNode;
};

const MapCanvas = forwardRef<MapView, Props>(function MapCanvas(
  {
    mode,
    pins,
    route,
    zones,
    heatmapPoints,
    selectedId,
    onSelectPin,
    layerRemountKey,
    children,
  },
  ref
) {
  const [latitudeDelta, setLatitudeDelta] = useState(
    INITIAL_REGION.latitudeDelta
  );
  const lastRegion = useRef<Region>(INITIAL_REGION);
  const [mountedKey, setMountedKey] = useState<string | null>(layerRemountKey);

  useEffect(() => {
    setMountedKey(null);
    const frame = requestAnimationFrame(() => setMountedKey(layerRemountKey));
    return () => cancelAnimationFrame(frame);
  }, [layerRemountKey]);

  const onRegionChangeComplete = (region: Region) => {
    lastRegion.current = region;
    setLatitudeDelta(region.latitudeDelta);
  };

  return (
    <View style={styles.mapWrap}>
      <MapView
        key={mode === "heatmap" ? layerRemountKey : mode}
        ref={ref}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        toolbarEnabled={false}
        initialRegion={lastRegion.current}
        onRegionChangeComplete={onRegionChangeComplete}
      >
        {mountedKey !== null && (
          <React.Fragment key={mountedKey}>
            {mode !== "zones" && (
              <PinLayer
                pins={pins}
                numbered={mode === "today"}
                selectedId={selectedId}
                onSelect={onSelectPin}
              />
            )}
            {mode === "today" && route.length >= 2 && (
              <RouteLayer route={route} />
            )}
            {mode === "heatmap" && <HeatmapLayer points={heatmapPoints} />}
            {mode === "zones" && (
              <ZoneLayer
                zones={zones}
                showTags={latitudeDelta < ZONE_LABEL_ZOOM_THRESHOLD}
              />
            )}
          </React.Fragment>
        )}
      </MapView>
      {children}
    </View>
  );
});

export default MapCanvas;

const styles = StyleSheet.create({
  mapWrap: {
    height: 320,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#E0F2FE",
    position: "relative",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
});
