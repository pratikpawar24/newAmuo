'use client';

import { getBadgeLabel } from '@/lib/utils';

interface BadgeShowcaseProps {
  badges: string[];
}

const BADGE_INFO: Record<string, { emoji: string; desc: string; color: string }> = {
  green_starter: { emoji: '🌱', desc: 'First step towards green mobility', color: 'bg-green-100 dark:bg-green-900/30' },
  eco_warrior: { emoji: '♻️', desc: '10+ eco-friendly rides', color: 'bg-emerald-100 dark:bg-emerald-900/30' },
  carbon_champion: { emoji: '🏆', desc: '50+ kg CO₂ saved', color: 'bg-yellow-100 dark:bg-yellow-900/30' },
  earth_guardian: { emoji: '🌍', desc: 'Top 10% greenest users', color: 'bg-blue-100 dark:bg-blue-900/30' },
  climate_hero: { emoji: '🦸', desc: 'Legendary sustainability champion', color: 'bg-purple-100 dark:bg-purple-900/30' },
};

export default function BadgeShowcase({ badges }: BadgeShowcaseProps) {
  if (badges.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-slate-400">
        No badges yet — keep riding green! 🌿
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {badges.map((badge) => {
        const info = BADGE_INFO[badge];
        return (
          <div key={badge} className={`rounded-xl p-4 text-center ${info?.color || 'bg-slate-100'}`}>
            <span className="text-3xl">{info?.emoji || '🎖️'}</span>
            <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">{getBadgeLabel(badge)}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{info?.desc || ''}</p>
          </div>
        );
      })}
    </div>
  );
}
