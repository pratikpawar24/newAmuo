'use client';

import { Polyline, Tooltip } from 'react-leaflet';
import { formatDistance, formatDuration, formatCO2 } from '@/lib/utils';
import type { RouteResult, OrionRouteResult, RouteSegment } from '@/types/traffic';

interface RoutePolylineProps {
  route: RouteResult;
  color?: string;
  weight?: number;
  showSegments?: boolean;
}

function getCongestionColor(congestion: number): string {
  if (congestion < 0.3) return '#22c55e';  // green — free flow
  if (congestion < 0.5) return '#eab308';  // yellow — light
  if (congestion < 0.7) return '#f97316';  // orange — moderate
  if (congestion < 0.85) return '#ef4444'; // red — heavy
  return '#991b1b';                        // dark red — gridlock
}

function SegmentPolylines({ segments, weight }: { segments: RouteSegment[]; weight: number }) {
  return (
    <>
      {segments.map((seg, i) => {
        const positions: [number, number][] = [
          [seg.from.lat, seg.from.lng],
          [seg.to.lat, seg.to.lng],
        ];
        const color = getCongestionColor(seg.congestion);
        return (
          <Polyline
            key={`seg-${i}`}
            positions={positions}
            pathOptions={{ color, weight, opacity: 0.9, lineJoin: 'round', lineCap: 'round' }}
          >
            <Tooltip sticky>
              <div className="text-xs">
                <p className="font-semibold">{formatDistance(seg.distance_km)}</p>
                <p>{Math.round(seg.speed_kmh)} km/h</p>
                <p>{formatCO2(seg.co2_grams)} CO₂</p>
                <p className="text-slate-500">Congestion: {(seg.congestion * 100).toFixed(0)}%</p>
              </div>
            </Tooltip>
          </Polyline>
        );
      })}
    </>
  );
}

export default function RoutePolyline({ route, color = '#10b981', weight = 5, showSegments = true }: RoutePolylineProps) {
  if (!route.path || route.path.length < 2) return null;

  // If ORION route with segments, show per-segment congestion coloring
  const orionRoute = route as OrionRouteResult;
  if (showSegments && orionRoute.segments && orionRoute.segments.length > 0) {
    return <SegmentPolylines segments={orionRoute.segments} weight={weight} />;
  }

  // Fallback: single polyline
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
