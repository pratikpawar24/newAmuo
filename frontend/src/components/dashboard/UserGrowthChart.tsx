'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';

interface UserGrowthData {
  date: string;
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
}

interface UserGrowthChartProps {
  data: UserGrowthData[];
}

export default function UserGrowthChart({ data }: UserGrowthChartProps) {
  if (!data || data.length === 0) return null;

  const formattedData = data.map((item) => ({
    ...item,
    formattedDate: format(new Date(item.date), 'MMM dd'),
  }));

  return (
    <div className="card">
      <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
        📈 User Growth Over Time
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={formattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
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
          <Area
            type="monotone"
            dataKey="totalUsers"
            name="Total Users"
            stroke="#10b981"
            fillOpacity={1}
            fill="url(#colorTotal)"
          />
          <Area
            type="monotone"
            dataKey="activeUsers"
            name="Active Users"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#colorActive)"
          />
          <Area
            type="monotone"
            dataKey="newUsers"
            name="New Users"
            stroke="#f59e0b"
            fillOpacity={1}
            fill="url(#colorNew)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
