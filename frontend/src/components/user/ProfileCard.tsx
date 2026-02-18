'use client';

import GreenScoreBadge from './GreenScoreBadge';
import { getInitials } from '@/lib/utils';
import type { User } from '@/types/user';

interface ProfileCardProps {
  user: User;
}

export default function ProfileCard({ user }: ProfileCardProps) {
  const displayName = user.fullName || user.name || 'User';
  const displayAvatar = user.avatarUrl || user.avatar;

  return (
    <div className="card text-center">
      {displayAvatar ? (
        <img src={displayAvatar} alt={displayName} className="mx-auto h-20 w-20 rounded-full object-cover" />
      ) : (
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-700 dark:bg-primary-900/30">
          {getInitials(displayName)}
        </div>
      )}
      <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">{displayName}</h2>
      <p className="text-sm text-slate-500">{user.email}</p>
      {user.bio && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{user.bio}</p>}

      <div className="mt-4 flex justify-center">
        <GreenScoreBadge score={user.greenScore} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{(user.stats?.totalRidesCreated || 0) + (user.stats?.totalRidesBooked || 0)}</p>
          <p className="text-xs text-slate-500">Rides</p>
        </div>
        <div>
          <p className="text-lg font-bold text-green-600">{(user.stats?.totalCO2SavedKg || 0).toFixed(1)}</p>
          <p className="text-xs text-slate-500">kg CO₂ Saved</p>
        </div>
        <div>
          <p className="text-lg font-bold text-accent-600">{(user.stats?.totalDistanceKm || 0).toFixed(0)}</p>
          <p className="text-xs text-slate-500">km Traveled</p>
        </div>
      </div>
    </div>
  );
}
