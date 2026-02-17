'use client';

import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProfileCard from '@/components/user/ProfileCard';
import BadgeShowcase from '@/components/user/BadgeShowcase';
import PreferencesForm from '@/components/user/PreferencesForm';
import { useAuth } from '@/hooks/useAuth';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !user) return <LoadingSpinner className="min-h-screen" size="lg" />;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-slate-900 dark:text-white">My Profile</h1>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6">
            <ProfileCard user={user} />
            <div className="card">
              <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">🎖️ Badges</h3>
              <BadgeShowcase badges={user.badges} />
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="card">
              <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Edit Profile & Preferences</h3>
              <PreferencesForm />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
