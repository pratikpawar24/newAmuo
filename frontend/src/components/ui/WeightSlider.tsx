'use client';

import { cn } from '@/lib/utils';

interface WeightSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  color?: string;
  icon?: string;
}

export default function WeightSlider({ label, value, onChange, color = 'primary', icon }: WeightSliderProps) {
  const colorMap: Record<string, string> = {
    primary: 'accent-primary-500',
    blue: 'accent-accent-500',
    green: 'accent-emerald-500',
    amber: 'accent-amber-500',
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {icon && <span className="mr-1">{icon}</span>}
          {label}
        </span>
        <span className="font-mono text-xs text-slate-500">{(value * 100).toFixed(0)}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={Math.round(value * 100)}
        onChange={(e) => onChange(parseInt(e.target.value) / 100)}
        className={cn('w-full h-2 rounded-full cursor-pointer', colorMap[color] || colorMap.primary)}
      />
    </div>
  );
}
