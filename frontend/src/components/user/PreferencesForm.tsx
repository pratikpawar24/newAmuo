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
  bio: string;
  smoking: boolean;
  music: boolean;
  pets: boolean;
  chatty: boolean;
  routePreference: 'fastest' | 'greenest' | 'balanced';
}

export default function PreferencesForm() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit } = useForm<FormData>({
    defaultValues: {
      name: user?.name || '',
      phone: user?.phone || '',
      bio: user?.bio || '',
      smoking: user?.preferences?.smoking || false,
      music: user?.preferences?.music ?? true,
      pets: user?.preferences?.pets || false,
      chatty: user?.preferences?.chatty ?? true,
      routePreference: user?.preferences?.routePreference || 'balanced',
    },
  });

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const { data: res } = await api.patch('/users/profile', {
        name: data.name,
        phone: data.phone,
        bio: data.bio,
        preferences: {
          smoking: data.smoking,
          music: data.music,
          pets: data.pets,
          chatty: data.chatty,
          routePreference: data.routePreference,
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
      <Input label="Bio" {...register('bio')} />

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Route Preference</p>
        <select {...register('routePreference')} className="input-field">
          <option value="fastest">🏎️ Fastest</option>
          <option value="greenest">🌿 Greenest</option>
          <option value="balanced">⚖️ Balanced</option>
        </select>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Ride Preferences</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: 'smoking' as const, label: '🚬 Smoking OK', key: 'smoking' },
            { name: 'music' as const, label: '🎵 Music OK', key: 'music' },
            { name: 'pets' as const, label: '🐕 Pets OK', key: 'pets' },
            { name: 'chatty' as const, label: '💬 Chatty', key: 'chatty' },
          ].map((pref) => (
            <label key={pref.key} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700">
              <input type="checkbox" {...register(pref.name)} className="h-4 w-4 rounded text-primary-500" />
              <span className="text-sm text-slate-700 dark:text-slate-300">{pref.label}</span>
            </label>
          ))}
        </div>
      </div>

      <Button type="submit" isLoading={saving}>Save Changes</Button>
    </form>
  );
}
