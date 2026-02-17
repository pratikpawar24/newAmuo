'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap, ZoomControl } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';

interface MapViewProps {
  center?: LatLngExpression;
  zoom?: number;
  children?: React.ReactNode;
  className?: string;
  dark?: boolean;
}

const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function MapUpdater({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

export default function MapView({ center = [19.076, 72.8777], zoom = 12, children, className, dark }: MapViewProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (dark !== undefined) { setIsDark(dark); return; }
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    setIsDark(document.documentElement.classList.contains('dark'));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [dark]);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      zoomControl={false}
      className={className || 'h-full w-full rounded-2xl'}
      style={{ minHeight: '400px' }}
    >
      <TileLayer url={isDark ? DARK_TILES : LIGHT_TILES} attribution={ATTRIBUTION} />
      <ZoomControl position="bottomright" />
      <MapUpdater center={center} zoom={zoom} />
      {children}
    </MapContainer>
  );
}
