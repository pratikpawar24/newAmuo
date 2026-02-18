'use client';

interface PeakHoursDataPoint {
  hour: number;
  day: number;
  rides: number;
}

interface PeakHoursHeatmapProps {
  data?: PeakHoursDataPoint[];
  matrix?: number[][];
  days?: string[];
}

const DEFAULT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PeakHoursHeatmap({ data, matrix, days = DEFAULT_DAYS }: PeakHoursHeatmapProps) {
  // Convert data array to matrix if provided
  let heatmapMatrix: number[][];
  
  if (matrix) {
    heatmapMatrix = matrix;
  } else if (data && data.length > 0) {
    // Create 7x24 matrix from data points
    heatmapMatrix = Array.from({ length: 7 }, () => Array(24).fill(0));
    data.forEach(({ hour, day, rides }) => {
      if (day >= 0 && day < 7 && hour >= 0 && hour < 24) {
        heatmapMatrix[day][hour] = rides;
      }
    });
  } else {
    return null;
  }

  if (heatmapMatrix.length === 0) return null;

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const maxVal = Math.max(...heatmapMatrix.flat());

  const getColor = (value: number) => {
    if (maxVal === 0) return 'bg-slate-100 dark:bg-slate-800';
    const intensity = value / maxVal;
    if (intensity >= 0.8) return 'bg-emerald-600 text-white';
    if (intensity >= 0.6) return 'bg-emerald-500 text-white';
    if (intensity >= 0.4) return 'bg-emerald-400';
    if (intensity >= 0.2) return 'bg-emerald-300';
    if (intensity > 0) return 'bg-emerald-200';
    return 'bg-slate-100 dark:bg-slate-800';
  };

  return (
    <div className="card overflow-x-auto">
      <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
        📊 Peak Hours Heatmap
      </h3>
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="mb-1 flex">
          <div className="w-12" />
          {hours.map((h) => (
            <div key={h} className="flex-1 text-center text-[10px] text-slate-500">
              {h.toString().padStart(2, '0')}
            </div>
          ))}
        </div>

        {/* Grid */}
        {heatmapMatrix.map((row, dayIdx) => (
          <div key={dayIdx} className="flex items-center">
            <div className="w-12 text-xs font-medium text-slate-600 dark:text-slate-400">
              {days[dayIdx]}
            </div>
            {row.map((value, hourIdx) => (
              <div
                key={hourIdx}
                className={`m-px h-6 flex-1 rounded-sm ${getColor(value)} flex items-center justify-center`}
                title={`${days[dayIdx]} ${hourIdx}:00 - ${value} rides`}
              >
                {value > 0 && (
                  <span className="text-[9px] font-medium">{value}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
        <span>Low</span>
        <div className="flex gap-0.5">
          <div className="h-3 w-6 rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-3 w-6 rounded bg-emerald-200" />
          <div className="h-3 w-6 rounded bg-emerald-300" />
          <div className="h-3 w-6 rounded bg-emerald-400" />
          <div className="h-3 w-6 rounded bg-emerald-500" />
          <div className="h-3 w-6 rounded bg-emerald-600" />
        </div>
        <span>High</span>
      </div>
    </div>
  );
}
