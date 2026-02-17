'use client';

import {
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ChartData {
  date: string;
  Rides: number;
  Users: number;
  'CO₂ Saved (kg)': number;
  'Distance (km)': number;
}

interface RechartsWrapperProps {
  chartData: ChartData[];
}

export default function RechartsWrapper({ chartData }: RechartsWrapperProps) {
  if (!chartData || chartData.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Daily Rides Chart */}
      <div className="card">
        <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          Daily Rides (30 days)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="Rides"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="Users"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* CO₂ Saved Chart */}
      <div className="card">
        <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          CO₂ Saved (30 days)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="CO₂ Saved (kg)" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Distance (km)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
