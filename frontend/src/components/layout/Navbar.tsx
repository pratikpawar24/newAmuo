'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import ThemeToggle from '@/components/ui/ThemeToggle';
import NotificationDropdown from '@/components/ui/NotificationDropdown';
import { cn, getInitials } from '@/lib/utils';
import { useState } from 'react';

const NAV_LINKS = [
  { href: '/', label: 'Map', icon: '🗺️' },
  { href: '/g-ride', label: 'G-Ride', icon: '🚗' },
  { href: '/chat', label: 'Chat', icon: '💬' },
];

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-extrabold text-primary-500">AUMO</span>
          <span className="rounded-md bg-primary-100 px-1.5 py-0.5 text-[10px] font-bold text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">v2</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === link.href
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              <span className="mr-1.5">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated && (
            <>
              <NotificationDropdown />
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {(user?.avatarUrl || user?.avatar) ? (
                    <img src={user.avatarUrl || user.avatar} alt={user.fullName || user.name} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
                      {getInitials(user?.fullName || user?.name || 'U')}
                    </div>
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    <div className="border-b p-3 dark:border-slate-700">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{user?.fullName || user?.name}</p>
                      <p className="text-xs text-slate-500">{user?.email}</p>
                    </div>
                    <Link href="/profile" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700">
                      Profile
                    </Link>
                    {user?.role === 'admin' && (
                      <Link href="/admin/dashboard" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700">
                        Admin Panel
                      </Link>
                    )}
                    <button
                      onClick={() => { logout(); setMenuOpen(false); }}
                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
          {!isAuthenticated && (
            <Link href="/login" className="btn-primary text-sm">
              Sign in
            </Link>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-slate-200 bg-white p-4 md:hidden dark:border-slate-700 dark:bg-slate-900">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm font-medium',
                pathname === link.href ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {link.icon} {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
