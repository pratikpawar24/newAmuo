'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';

interface RideStatusPieProps {
  data: { name: string; value: number; color: string }[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export default function RideStatusPie({ data }: RideStatusPieProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="card">
      <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
        🚗 Ride Status Distribution
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
