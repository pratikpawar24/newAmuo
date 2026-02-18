'use client';

import { useForm } from 'react-hook-form';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import { useState } from 'react';
import type { UserPreferences } from '@/types/user';

interface FormData {
  name: string;
  phone: string;
  smokingAllowed: boolean;
  sameGenderOnly: boolean;
  maxDetourMinutes: number;
  pickupFlexibilityMeters: number;
  musicPreference: 'silent' | 'any' | 'no_preference';
}

export default function PreferencesForm() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit } = useForm<FormData>({
    defaultValues: {
      name: user?.fullName || user?.name || '',
      phone: user?.phone || '',
      smokingAllowed: user?.preferences?.smokingAllowed ?? false,
      sameGenderOnly: user?.preferences?.sameGenderOnly ?? false,
      maxDetourMinutes: user?.preferences?.maxDetourMinutes ?? 15,
      pickupFlexibilityMeters: user?.preferences?.pickupFlexibilityMeters ?? 500,
      musicPreference: user?.preferences?.musicPreference || 'no_preference',
    },
  });

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const { data: res } = await api.patch('/users/profile', {
        name: data.name,
        phone: data.phone,
        preferences: {
          smokingAllowed: data.smokingAllowed,
          sameGenderOnly: data.sameGenderOnly,
          maxDetourMinutes: data.maxDetourMinutes,
          pickupFlexibilityMeters: data.pickupFlexibilityMeters,
          musicPreference: data.musicPreference,
        },
      });
      updateUser(res.data);
      toast.success('Profile updated!');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Name" {...register('name')} />
        <Input label="Phone" type="tel" {...register('phone')} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Max Detour (minutes)</label>
          <input type="number" {...register('maxDetourMinutes', { valueAsNumber: true })} className="input-field w-full" min={0} max={60} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Pickup Flexibility (meters)</label>
          <input type="number" {...register('pickupFlexibilityMeters', { valueAsNumber: true })} className="input-field w-full" min={0} max={2000} step={100} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Music Preference</p>
        <select {...register('musicPreference')} className="input-field">
          <option value="no_preference">� No Preference</option>
          <option value="any">� Music OK</option>
          <option value="silent">🔇 Prefer Silent</option>
        </select>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Ride Preferences</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700">
            <input type="checkbox" {...register('smokingAllowed')} className="h-4 w-4 rounded text-primary-500" />
            <span className="text-sm text-slate-700 dark:text-slate-300">🚬 Smoking Allowed</span>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700">
            <input type="checkbox" {...register('sameGenderOnly')} className="h-4 w-4 rounded text-primary-500" />
            <span className="text-sm text-slate-700 dark:text-slate-300">👤 Same Gender Only</span>
          </label>
        </div>
      </div>

      <Button type="submit" isLoading={saving}>Save Changes</Button>
    </form>
  );
}
