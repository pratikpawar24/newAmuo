'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/layout/Sidebar';
import StatsCard from '@/components/dashboard/StatsCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatCO2 } from '@/lib/utils';
import toast from 'react-hot-toast';

const RechartsWrapper = dynamic<{ chartData: Array<Record<string, unknown>> }>(
  () => import('../../../components/dashboard/RechartsWrapper') as any,
  { ssr: false }
);

const PeakHoursHeatmap = dynamic(
  () => import('@/components/dashboard/PeakHoursHeatmap'),
  { ssr: false }
);

const RideStatusPie = dynamic(
  () => import('@/components/dashboard/RideStatusPie'),
  { ssr: false }
);

const UserGrowthChart = dynamic(
  () => import('@/components/dashboard/UserGrowthChart'),
  { ssr: false }
);

const EmissionsChart = dynamic(
  () => import('@/components/dashboard/EmissionsChart'),
  { ssr: false }
);

const OccupancyScatter = dynamic(
  () => import('@/components/dashboard/OccupancyScatter'),
  { ssr: false }
);

interface DashboardStats {
  totalUsers: number;
  totalRides: number;
  activeRides: number;
  completedRides: number;
  totalCO2Saved: number;
  avgGreenScore: number;
  totalDistance: number;
}

interface DailyStat {
  date: string;
  rides: number;
  users: number;
  co2Saved: number;
  distance: number;
}

interface UserRow {
  _id: string;
  name: string;
  email: string;
  role: string;
  greenScore: number;
  totalRides: number;
  banned?: boolean;
  createdAt: string;
}

interface RideRow {
  _id: string;
  driver: { name: string; email: string } | string;
  origin: { address: string };
  destination: { address: string };
  status: string;
  departureTime: string;
  totalSeats: number;
  availableSeats: number;
  estimatedEmissions: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [rides, setRides] = useState<RideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'users' | 'rides'>('overview');

  // Analytics data
  const [peakHoursData, setPeakHoursData] = useState<{ hour: number; day: number; rides: number }[]>([]);
  const [userGrowthData, setUserGrowthData] = useState<{ date: string; totalUsers: number; activeUsers: number; newUsers: number }[]>([]);
  const [emissionsData, setEmissionsData] = useState<{ date: string; totalEmissions: number; savedEmissions: number; avgPerRide: number }[]>([]);

  // User management
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Pagination
  const [userPage, setUserPage] = useState(1);
  const [ridePage, setRidePage] = useState(1);
  const pageSize = 10;

  const loadAnalytics = useCallback(async () => {
    try {
      const [peakRes, growthRes, emissionsRes] = await Promise.all([
        api.get('/admin/analytics/peak-hours'),
        api.get('/admin/analytics/user-growth?days=30'),
        api.get('/admin/analytics/emissions?days=14'),
      ]);

      if (peakRes.data.success) setPeakHoursData(peakRes.data.data || []);
      if (growthRes.data.success) setUserGrowthData(growthRes.data.data || []);
      if (emissionsRes.data.success) setEmissionsData(emissionsRes.data.data || []);
    } catch (err) {
      console.error('Failed to load analytics', err);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, dailyRes, usersRes, ridesRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/stats/daily?days=30'),
        api.get('/admin/users?limit=100'),
        api.get('/admin/rides?limit=100'),
      ]);

      if (statsRes.data.success) setStats(statsRes.data.data);
      if (dailyRes.data.success) setDailyStats(dailyRes.data.data);
      if (usersRes.data.success) setUsers(usersRes.data.data.users || usersRes.data.data);
      if (ridesRes.data.success) setRides(ridesRes.data.data.rides || ridesRes.data.data);

      // Load analytics data too
      await loadAnalytics();
    } catch (err: any) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [loadAnalytics]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/admin/login');
      return;
    }
    if (!authLoading && isAuthenticated && user?.role !== 'admin') {
      toast.error('Access denied');
      router.push('/');
      return;
    }
    if (!authLoading && isAuthenticated && user?.role === 'admin') {
      loadDashboard();
    }
  }, [authLoading, isAuthenticated, user, router, loadDashboard]);

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      toast.success(`Role updated to ${newRole}`);
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
      );
    } catch {
      toast.error('Failed to update role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success('User deleted');
      setUsers((prev) => prev.filter((u) => u._id !== userId));
      setUserModalOpen(false);
    } catch {
      toast.error('Failed to delete user');
    }
  };

  const handleBanUser = async (userId: string, currentlyBanned: boolean) => {
    const action = currentlyBanned ? 'unban' : 'ban';
    try {
      await api.patch(`/admin/users/${userId}/ban`, { banned: !currentlyBanned });
      toast.success(`User ${action}ned successfully`);
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, banned: !currentlyBanned } : u))
      );
    } catch {
      toast.error(`Failed to ${action} user`);
    }
  };

  const handleForceDeleteRide = async (rideId: string) => {
    if (!confirm('Are you sure you want to force delete this ride?')) return;
    try {
      await api.delete(`/admin/rides/${rideId}`);
      toast.success('Ride deleted');
      setRides((prev) => prev.filter((r) => r._id !== rideId));
    } catch {
      toast.error('Failed to delete ride');
    }
  };

  if (authLoading || loading) return <LoadingSpinner className="min-h-screen" size="lg" />;
  if (!stats) return null;

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );
  const pagedUsers = filteredUsers.slice((userPage - 1) * pageSize, userPage * pageSize);
  const totalUserPages = Math.ceil(filteredUsers.length / pageSize);

  const pagedRides = rides.slice((ridePage - 1) * pageSize, ridePage * pageSize);
  const totalRidePages = Math.ceil(rides.length / pageSize);

  const chartData = dailyStats.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    Rides: d.rides,
    Users: d.users,
    'CO₂ Saved (kg)': parseFloat((d.co2Saved / 1000).toFixed(2)),
    'Distance (km)': parseFloat((d.distance / 1000).toFixed(1)),
  }));

  const statusColor: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar />

      <main className="flex-1 overflow-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              📊 Admin Dashboard
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Welcome back, {user?.name}
            </p>
          </div>
          <button
            onClick={loadDashboard}
            className="btn-primary self-start text-sm"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-slate-200/50 p-1 dark:bg-slate-800">
          {(['overview', 'analytics', 'users', 'rides'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium capitalize transition ${
                activeTab === tab
                  ? 'bg-white text-emerald-700 shadow dark:bg-slate-700 dark:text-emerald-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {tab === 'overview' && '📈 '}
              {tab === 'analytics' && '📊 '}
              {tab === 'users' && '👥 '}
              {tab === 'rides' && '🚗 '}
              {tab}
            </button>
          ))}
        </div>

        {/* ─── OVERVIEW TAB ─── */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatsCard
                title="Total Users"
                value={stats.totalUsers.toLocaleString()}
                icon="👥"
                color="emerald"
              />
              <StatsCard
                title="Total Rides"
                value={stats.totalRides.toLocaleString()}
                icon="🚗"
                color="blue"
              />
              <StatsCard
                title="Active Rides"
                value={stats.activeRides.toLocaleString()}
                icon="🟢"
                color="yellow"
              />
              <StatsCard
                title="CO₂ Saved"
                value={formatCO2(stats.totalCO2Saved)}
                icon="🌱"
                color="emerald"
              />
              <StatsCard
                title="Completed Rides"
                value={stats.completedRides.toLocaleString()}
                icon="✅"
                color="emerald"
              />
              <StatsCard
                title="Avg Green Score"
                value={stats.avgGreenScore.toFixed(1)}
                icon="🏆"
                color="yellow"
              />
              <StatsCard
                title="Total Distance"
                value={`${(stats.totalDistance / 1000).toFixed(0)} km`}
                icon="📏"
                color="blue"
              />
              <StatsCard
                title="Users Online"
                value="-"
                icon="🌐"
                color="blue"
              />
            </div>

            {/* Charts */}
            {chartData.length > 0 && (
              <RechartsWrapper chartData={chartData} />
            )}
          </div>
        )}

        {/* ─── ANALYTICS TAB ─── */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            {/* Peak Hours Heatmap & Ride Status Pie */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <PeakHoursHeatmap data={peakHoursData} />
              <RideStatusPie
                data={[
                  { name: 'Completed', value: stats?.completedRides || 0, color: '#10b981' },
                  { name: 'Active', value: stats?.activeRides || 0, color: '#3b82f6' },
                  { name: 'Scheduled', value: (stats?.totalRides || 0) - (stats?.completedRides || 0) - (stats?.activeRides || 0), color: '#f59e0b' },
                ]}
              />
            </div>

            {/* User Growth Chart */}
            <UserGrowthChart data={userGrowthData} />

            {/* Emissions Chart & Occupancy Scatter */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <EmissionsChart data={emissionsData} />
              <OccupancyScatter
                data={rides.slice(0, 50).map((r) => ({
                  rideId: r._id,
                  occupancy: (r.totalSeats || 4) - r.availableSeats,
                  emissions: r.estimatedEmissions || Math.random() * 5,
                  distance: Math.random() * 50 + 5,
                }))}
              />
            </div>
          </div>
        )}

        {/* ─── USERS TAB ─── */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="🔍 Search users..."
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setUserPage(1);
                }}
                className="input max-w-sm"
              />
              <span className="text-sm text-slate-500">
                {filteredUsers.length} user{filteredUsers.length !== 1 && 's'}
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Role</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Green Score</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Rides</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Joined</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {pagedUsers.map((u) => (
                    <tr key={u._id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 ${u.banned ? 'opacity-50 bg-red-50 dark:bg-red-900/10' : ''}`}>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {u.name}
                        {u.banned && <span className="ml-2 text-xs text-red-500">🚫 Banned</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{u.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {u.greenScore?.toFixed(1) ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{u.totalRides ?? 0}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setUserModalOpen(true);
                            }}
                            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleToggleRole(u._id, u.role)}
                            className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
                          >
                            Toggle Role
                          </button>
                          <button
                            onClick={() => handleBanUser(u._id, !!u.banned)}
                            className={`text-xs hover:underline ${u.banned ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                          >
                            {u.banned ? 'Unban' : 'Ban'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalUserPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  disabled={userPage <= 1}
                  onClick={() => setUserPage((p) => p - 1)}
                  className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40 dark:border-slate-700"
                >
                  ← Prev
                </button>
                <span className="text-sm text-slate-500">
                  {userPage} / {totalUserPages}
                </span>
                <button
                  disabled={userPage >= totalUserPages}
                  onClick={() => setUserPage((p) => p + 1)}
                  className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40 dark:border-slate-700"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── RIDES TAB ─── */}
        {activeTab === 'rides' && (
          <div className="space-y-4">
            <span className="text-sm text-slate-500">
              {rides.length} ride{rides.length !== 1 && 's'} total
            </span>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Driver</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Route</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Departure</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Seats</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">CO₂ (g)</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {pagedRides.map((r) => {
                    const driverName =
                      typeof r.driver === 'string' ? r.driver : r.driver?.name ?? 'Unknown';
                    return (
                      <tr key={r._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                          {driverName}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-slate-600 dark:text-slate-400">
                          {r.origin?.address?.split(',')[0]} → {r.destination?.address?.split(',')[0]}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              statusColor[r.status] ?? 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {formatDate(r.departureTime)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {r.availableSeats}/{r.totalSeats}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {r.estimatedEmissions?.toFixed(0) ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleForceDeleteRide(r._id)}
                            className="text-xs text-red-600 hover:underline dark:text-red-400"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalRidePages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  disabled={ridePage <= 1}
                  onClick={() => setRidePage((p) => p - 1)}
                  className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40 dark:border-slate-700"
                >
                  ← Prev
                </button>
                <span className="text-sm text-slate-500">
                  {ridePage} / {totalRidePages}
                </span>
                <button
                  disabled={ridePage >= totalRidePages}
                  onClick={() => setRidePage((p) => p + 1)}
                  className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40 dark:border-slate-700"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* User detail modal */}
      <Modal isOpen={userModalOpen} onClose={() => setUserModalOpen(false)} title="User Details">
        {selectedUser && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500">Name</p>
                <p className="font-medium text-slate-900 dark:text-white">{selectedUser.name}</p>
              </div>
              <div>
                <p className="text-slate-500">Email</p>
                <p className="font-medium text-slate-900 dark:text-white">{selectedUser.email}</p>
              </div>
              <div>
                <p className="text-slate-500">Role</p>
                <p className="font-medium capitalize text-slate-900 dark:text-white">{selectedUser.role}</p>
              </div>
              <div>
                <p className="text-slate-500">Green Score</p>
                <p className="font-medium text-emerald-600">{selectedUser.greenScore?.toFixed(1) ?? '-'}</p>
              </div>
              <div>
                <p className="text-slate-500">Total Rides</p>
                <p className="font-medium text-slate-900 dark:text-white">{selectedUser.totalRides ?? 0}</p>
              </div>
              <div>
                <p className="text-slate-500">Joined</p>
                <p className="font-medium text-slate-900 dark:text-white">{formatDate(selectedUser.createdAt)}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4 dark:border-slate-700">
              <button
                onClick={() => handleToggleRole(selectedUser._id, selectedUser.role)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Toggle Role
              </button>
              <button
                onClick={() => handleDeleteUser(selectedUser._id)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                Delete User
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
