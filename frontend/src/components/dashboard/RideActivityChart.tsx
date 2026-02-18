'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';

interface RideActivityData {
  date: string;
  totalRides: number;
  completedRides: number;
  cancelledRides: number;
}

interface RideActivityChartProps {
  data: RideActivityData[];
}

export default function RideActivityChart({ data }: RideActivityChartProps) {
  if (!data || data.length === 0) return null;

  const formattedData = data.map((item) => ({
    ...item,
    formattedDate: format(new Date(item.date), 'MMM dd'),
  }));

  return (
    <div className="card">
      <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
        🚗 Daily Ride Activity
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
          <XAxis dataKey="formattedDate" className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="totalRides"
            name="Total Rides"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="completedRides"
            name="Completed"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981', strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="cancelledRides"
            name="Cancelled"
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ fill: '#ef4444', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
