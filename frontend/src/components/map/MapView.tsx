'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap, ZoomControl, Circle, Marker, Popup } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';

interface MapViewProps {
  center?: LatLngExpression;
  zoom?: number;
  children?: React.ReactNode;
  className?: string;
  dark?: boolean;
  showUserLocation?: boolean;
}

const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Custom blue dot icon for user location
const userLocationIcon = typeof window !== 'undefined' ? L.divIcon({
  className: 'user-location-marker',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 8px rgba(59,130,246,0.5);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
}) : undefined;

function MapUpdater({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

function UserLocationLayer() {
  const [pos, setPos] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setPos({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => { /* silently fail */ },
      { enableHighAccuracy: true, maximumAge: 30000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  if (!pos || !userLocationIcon) return null;

  return (
    <>
      <Circle
        center={[pos.lat, pos.lng]}
        radius={pos.accuracy}
        pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 1 }}
      />
      <Marker position={[pos.lat, pos.lng]} icon={userLocationIcon}>
        <Popup>📍 You are here</Popup>
      </Marker>
    </>
  );
}

export default function MapView({ center = [18.5204, 73.8567], zoom = 12, children, className, dark, showUserLocation = true }: MapViewProps) {
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
      {showUserLocation && <UserLocationLayer />}
      {children}
    </MapContainer>
  );
}
