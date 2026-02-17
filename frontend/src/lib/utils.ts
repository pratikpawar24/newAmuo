import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatCO2(grams: number): string {
  if (grams < 1000) return `${Math.round(grams)} g`;
  return `${(grams / 1000).toFixed(2)} kg`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getBadgeLabel(badge: string): string {
  const map: Record<string, string> = {
    green_starter: '🌱 Green Starter',
    eco_warrior: '♻️ Eco Warrior',
    carbon_champion: '🏆 Carbon Champion',
    earth_guardian: '🌍 Earth Guardian',
    climate_hero: '🦸 Climate Hero',
  };
  return map[badge] || badge;
}

export function getGreenScoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-500';
  if (score >= 70) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  if (score >= 30) return 'text-orange-500';
  return 'text-red-500';
}

export function getCongestionColor(level: string): string {
  const map: Record<string, string> = {
    free: '#22c55e',
    light: '#84cc16',
    moderate: '#eab308',
    heavy: '#f97316',
    gridlock: '#ef4444',
  };
  return map[level] || '#6b7280';
}
