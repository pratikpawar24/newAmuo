'use client';

import { getGreenScoreColor, getBadgeLabel } from '@/lib/utils';

interface GreenScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function GreenScoreBadge({ score, size = 'md' }: GreenScoreBadgeProps) {
  const sizes = { sm: 'h-16 w-16 text-lg', md: 'h-24 w-24 text-2xl', lg: 'h-32 w-32 text-4xl' };
  const radius = size === 'sm' ? 24 : size === 'md' ? 38 : 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className={sizes[size]} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-200 dark:text-slate-700" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          className={getGreenScoreColor(score).replace('text-', 'stroke-')}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text x="60" y="60" textAnchor="middle" dominantBaseline="central" className="fill-current font-bold" fontSize={size === 'sm' ? 20 : size === 'md' ? 28 : 36}>
          {score}
        </text>
      </svg>
    </div>
  );
}
