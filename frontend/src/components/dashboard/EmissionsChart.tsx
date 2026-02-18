'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';

interface EmissionsData {
  date: string;
  totalEmissions: number;
  savedEmissions: number;
  avgPerRide: number;
}

interface EmissionsChartProps {
  data: EmissionsData[];
  showTarget?: boolean;
  targetValue?: number;
}

export default function EmissionsChart({ data, showTarget = true, targetValue = 50 }: EmissionsChartProps) {
  if (!data || data.length === 0) return null;

  const formattedData = data.map((item) => ({
    ...item,
    formattedDate: format(new Date(item.date), 'MMM dd'),
  }));

  return (
    <div className="card">
      <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
        🌍 CO₂ Emissions Overview
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={formattedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
          <XAxis dataKey="formattedDate" className="text-xs" />
          <YAxis className="text-xs" unit=" kg" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
            }}
            formatter={(value: number, name: string) => [
              `${value.toFixed(2)} kg CO₂`,
              name === 'totalEmissions' ? 'Total Emissions' :
              name === 'savedEmissions' ? 'Saved Emissions' : 'Avg Per Ride'
            ]}
          />
          <Legend />
          <Bar
            dataKey="totalEmissions"
            name="Total Emissions"
            fill="#ef4444"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="savedEmissions"
            name="Saved by Carpooling"
            fill="#10b981"
            radius={[4, 4, 0, 0]}
          />
          {showTarget && (
            <ReferenceLine
              y={targetValue}
              label="Daily Target"
              stroke="#f59e0b"
              strokeDasharray="5 5"
            />
          )}
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-red-500">
            {data.reduce((sum, d) => sum + d.totalEmissions, 0).toFixed(1)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total kg CO₂</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-emerald-500">
            {data.reduce((sum, d) => sum + d.savedEmissions, 0).toFixed(1)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Saved kg CO₂</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-blue-500">
            {(data.reduce((sum, d) => sum + d.avgPerRide, 0) / data.length).toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Avg per Ride</p>
        </div>
      </div>
    </div>
  );
}
