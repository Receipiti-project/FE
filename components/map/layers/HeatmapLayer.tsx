import { HEATMAP_GRADIENT } from "@/constants/mapConfig";
import { HeatPoint } from "@/scripts/useMapData";
import React from "react";
import { Heatmap } from "react-native-maps";

type Props = { points: HeatPoint[] };

export default function HeatmapLayer({ points }: Props) {
  if (points.length === 0) return null;

  return (
    <Heatmap
      points={points}
      radius={50}
      opacity={0.7}
      gradient={HEATMAP_GRADIENT}
    />
  );
}
