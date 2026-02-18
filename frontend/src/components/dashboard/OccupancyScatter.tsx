'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  Legend,
} from 'recharts';

interface OccupancyEmissionsData {
  occupancy: number;
  emissions: number;
  rideId: string;
  distance: number;
}

interface OccupancyScatterProps {
  data: OccupancyEmissionsData[];
}

export default function OccupancyScatter({ data }: OccupancyScatterProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="card">
      <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
        🌱 Occupancy vs Emissions
      </h3>
      <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
        Higher occupancy = lower per-passenger emissions
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
          <XAxis
            type="number"
            dataKey="occupancy"
            name="Occupancy"
            unit=" passengers"
            domain={[0, 5]}
            className="text-xs"
          />
          <YAxis
            type="number"
            dataKey="emissions"
            name="Emissions"
            unit=" kg CO₂"
            className="text-xs"
          />
          <ZAxis type="number" dataKey="distance" range={[50, 400]} name="Distance" unit=" km" />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload as OccupancyEmissionsData;
                return (
                  <div className="rounded-lg bg-white p-3 shadow-lg dark:bg-slate-800">
                    <p className="font-medium text-slate-900 dark:text-white">
                      Ride: {data.rideId.slice(-6)}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      👥 Occupancy: {data.occupancy} passengers
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      🌿 Emissions: {data.emissions.toFixed(2)} kg CO₂
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      📏 Distance: {data.distance.toFixed(1)} km
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend />
          <Scatter
            name="Rides"
            data={data}
            fill="#10b981"
            fillOpacity={0.6}
            stroke="#059669"
            strokeWidth={1}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
