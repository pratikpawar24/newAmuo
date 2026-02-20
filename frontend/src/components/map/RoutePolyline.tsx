'use client';

import { Polyline, Tooltip } from 'react-leaflet';
import { formatDistance, formatDuration, formatCO2 } from '@/lib/utils';
import type { RouteResult } from '@/types/traffic';

interface RoutePolylineProps {
  route: RouteResult;
  color?: string;
  weight?: number;
}

export default function RoutePolyline({ route, color = '#10b981', weight = 5 }: RoutePolylineProps) {
  if (!route.path || route.path.length < 2) return null;

  const positions = route.path.map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <Polyline
      positions={positions}
      pathOptions={{ color, weight, opacity: 0.8, lineJoin: 'round', lineCap: 'round' }}
    >
      <Tooltip sticky>
        <div className="text-xs">
          <p className="font-semibold">{formatDistance(route.distance_km)}</p>
          <p>{formatDuration(route.duration_min)}</p>
          <p className="text-green-600">{formatCO2(route.emissions_g)} CO₂</p>
        </div>
      </Tooltip>
    </Polyline>
  );
}
