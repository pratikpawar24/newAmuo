'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getCongestionColor } from '@/lib/utils';
import type { TrafficPrediction } from '@/types/traffic';

interface TrafficHeatmapProps {
  data: TrafficPrediction[];
}

export default function TrafficHeatmap({ data }: TrafficHeatmapProps) {
  const map = useMap();

  useEffect(() => {
    if (!data || data.length === 0) return;

    const circles = data
      .filter((d) => d.lat && d.lng)
      .map((d) =>
        L.circleMarker([d.lat!, d.lng!], {
          radius: 10 + d.density * 20,
          fillColor: getCongestionColor(d.congestionLevel),
          fillOpacity: 0.5,
          color: getCongestionColor(d.congestionLevel),
          weight: 1,
          opacity: 0.7,
        }).bindTooltip(
          `<b>${d.segmentId}</b><br/>Speed: ${d.speed.toFixed(1)} km/h<br/>Density: ${(d.density * 100).toFixed(0)}%<br/>${d.congestionLevel}`,
          { direction: 'top' }
        )
      );

    const group = L.layerGroup(circles).addTo(map);
    return () => { map.removeLayer(group); };
  }, [map, data]);

  return null;
}
