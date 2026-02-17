'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Requires leaflet.markercluster CSS + JS loaded via CDN or npm
// npm install leaflet.markercluster @types/leaflet.markercluster

interface MarkerClusterProps {
  markers: Array<{
    lat: number;
    lng: number;
    popup?: string;
    icon?: L.Icon;
  }>;
  maxClusterRadius?: number;
}

export default function MarkerCluster({
  markers,
  maxClusterRadius = 60,
}: MarkerClusterProps) {
  const map = useMap();

  useEffect(() => {
    // Dynamic import for markercluster plugin
    const loadCluster = async () => {
      try {
        await import('leaflet.markercluster');
        // @ts-ignore – markerClusterGroup is added by the plugin
        const clusterGroup = L.markerClusterGroup({
          maxClusterRadius,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
          iconCreateFunction: (cluster: any) => {
            const count = cluster.getChildCount();
            let size = 'small';
            let px = 30;
            if (count >= 100) {
              size = 'large';
              px = 50;
            } else if (count >= 10) {
              size = 'medium';
              px = 40;
            }
            return L.divIcon({
              html: `<div class="flex items-center justify-center rounded-full bg-emerald-500/90 text-white font-bold text-xs shadow-lg" style="width:${px}px;height:${px}px">${count}</div>`,
              className: `marker-cluster marker-cluster-${size}`,
              iconSize: L.point(px, px),
            });
          },
        });

        markers.forEach((m) => {
          const marker = L.marker([m.lat, m.lng], {
            ...(m.icon ? { icon: m.icon } : {}),
          });
          if (m.popup) marker.bindPopup(m.popup);
          clusterGroup.addLayer(marker);
        });

        map.addLayer(clusterGroup);

        return () => {
          map.removeLayer(clusterGroup);
        };
      } catch {
        // fallback: just add plain markers if plugin not available
        const layerGroup = L.layerGroup();
        markers.forEach((m) => {
          const marker = L.marker([m.lat, m.lng]);
          if (m.popup) marker.bindPopup(m.popup);
          layerGroup.addLayer(marker);
        });
        map.addLayer(layerGroup);
        return () => {
          map.removeLayer(layerGroup);
        };
      }
    };

    let cleanup: (() => void) | undefined;
    loadCluster().then((fn) => {
      cleanup = fn;
    });

    return () => {
      cleanup?.();
    };
  }, [map, markers, maxClusterRadius]);

  return null;
}
